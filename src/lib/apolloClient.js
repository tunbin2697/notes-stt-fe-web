import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
  Observable,
  concat,
} from "@apollo/client";

const httpLink = new HttpLink({
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
const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem("accessToken");

  if (token) {
    operation.setContext(({ headers = {} }) => ({
      headers: {
        ...headers,
        authorization: `Bearer ${token}`,
      },
    }));
  }

  return forward(operation);
});

// Custom link to intercept and handle auth errors from response
const authRefreshLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    let subscription;

    Promise.resolve(operation)
      .then(() => {
        subscription = forward(operation).subscribe({
          next: (result) => {
            // Check if response has auth errors
            if (result.errors && result.errors.length > 0) {
              const authError = result.errors.find(
                (err) =>
                  err.extensions?.code === "UNAUTHORIZED" ||
                  err.extensions?.code === "UNAUTHENTICATED" ||
                  err.message?.includes("Unauthorized") ||
                  err.message?.includes("Invalid token") ||
                  err.message?.includes("Token expired")
              );

              if (authError) {
                console.log(
                  "Auth error detected, checking if should refresh..."
                );

                const hasToken = localStorage.getItem("accessToken");

                if (!hasToken) {
                  console.log("Skipping token refresh - no token");
                  observer.next(result);
                  observer.complete();
                  return;
                }

                // Get operation identifier for tracking attempts
                const operationId = operation.operationName || "unknown";
                const attempts = refreshAttempts.get(operationId) || 0;

                // Try refresh up to 2 times
                if (attempts < 2) {
                  refreshAttempts.set(operationId, attempts + 1);
                  console.log(
                    `Attempting token refresh (attempt ${attempts + 1}/2)`
                  );

                  // Attempt to refresh token and retry
                  refreshAccessToken()
                    .then((newToken) => {
                      console.log("Token refreshed, retrying operation");
                      refreshAttempts.delete(operationId);

                      // Update headers with new token
                      operation.setContext(({ headers = {} }) => ({
                        headers: {
                          ...headers,
                          authorization: `Bearer ${newToken}`,
                        },
                      }));

                      // Retry the operation
                      const retrySubscription = forward(operation).subscribe({
                        next: observer.next.bind(observer),
                        error: observer.error.bind(observer),
                        complete: observer.complete.bind(observer),
                      });

                      // Handle unsubscribe
                      return () => {
                        if (retrySubscription) retrySubscription.unsubscribe();
                      };
                    })
                    .catch((error) => {
                      console.error("Token refresh failed:", error);
                      refreshAttempts.delete(operationId);
                      observer.error(error);
                    });

                  return;
                } else {
                  // Max attempts reached
                  refreshAttempts.delete(operationId);
                  console.error("Max token refresh attempts reached");
                  localStorage.removeItem("accessToken");
                  window.location.href = "/login";
                  return;
                }
              }
            }

            // No auth error, pass through
            observer.next(result);
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          },
          complete: () => {
            observer.complete();
          },
        });
      })
      .catch((error) => {
        observer.error(error);
      });

    // Cleanup function
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  });
});

// Create Apollo Client
const client = new ApolloClient({
  link: concat(authLink, concat(authRefreshLink, httpLink)),
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
