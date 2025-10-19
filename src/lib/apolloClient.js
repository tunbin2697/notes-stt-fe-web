import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { Observable } from "@apollo/client";

const httpLink = createHttpLink({
  uri:
    import.meta.env.VITE_GRAPHQL_ENDPOINT ||
    "https://notes-stt.baokhangdev.click/graphql",
  credentials: "include", // Important for cookies (refresh token)
});

// Track refresh attempts per request to prevent infinite loops
const refreshAttempts = new Map();

// Function to refresh access token
const refreshAccessToken = async () => {
  try {
    const response = await fetch(
      import.meta.env.VITE_GRAPHQL_ENDPOINT ||
        "https://notes-stt.baokhangdev.click/graphql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Send refresh token cookie
        body: JSON.stringify({
          query: `mutation { refresh { accessToken } }`,
        }),
      }
    );

    const result = await response.json();

    if (result.data?.refresh?.accessToken) {
      localStorage.setItem("accessToken", result.data.refresh.accessToken);
      return result.data.refresh.accessToken;
    }

    throw new Error("Failed to refresh token");
  } catch (error) {
    console.error("Token refresh failed:", error);
    // Clear tokens and redirect to login
    localStorage.removeItem("accessToken");
    window.location.href = "/login";
    throw error;
  }
};

// Auth link to add access token to headers
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("accessToken");
  return {
    headers: {
      ...headers,
      ...(token && { authorization: `Bearer ${token}` }),
    },
  };
});

// Error handling link with automatic token refresh
const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      for (const err of graphQLErrors) {
        console.error(`[GraphQL error]: ${err.message}`);

        // Check if error is authentication related
        if (
          err.extensions?.code === "UNAUTHENTICATED" ||
          err.message.includes("Unauthorized") ||
          err.message.includes("Invalid token") ||
          err.message.includes("Token expired")
        ) {
          // Get operation identifier for tracking attempts
          const operationId = operation.operationName || "unknown";
          const attempts = refreshAttempts.get(operationId) || 0;

          // Try refresh up to 2 times
          if (attempts < 2) {
            refreshAttempts.set(operationId, attempts + 1);

            // Return observable to retry the request after token refresh
            return new Observable((observer) => {
              refreshAccessToken()
                .then((newToken) => {
                  // Update the operation context with new token
                  operation.setContext(({ headers = {} }) => ({
                    headers: {
                      ...headers,
                      authorization: `Bearer ${newToken}`,
                    },
                  }));

                  // Retry the request
                  const subscriber = {
                    next: observer.next.bind(observer),
                    error: observer.error.bind(observer),
                    complete: observer.complete.bind(observer),
                  };

                  forward(operation).subscribe(subscriber);
                })
                .catch((error) => {
                  // If refresh fails, reset attempts and error out
                  refreshAttempts.delete(operationId);
                  observer.error(error);
                });
            });
          } else {
            // Max attempts reached, clear and redirect to login
            refreshAttempts.delete(operationId);
            console.error("Max token refresh attempts reached");
            localStorage.removeItem("accessToken");
            window.location.href = "/login";
          }
        }
      }
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError}`);
    }
  }
);

// Create Apollo Client
const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          notes: {
            keyArgs: [
              "type",
              "status",
              "isArchived",
              "isPinned",
              "tags",
              "search",
              "isUpcoming",
              "isOverdue",
            ],
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
    query: {
      fetchPolicy: "cache-first",
    },
  },
});

export default client;
