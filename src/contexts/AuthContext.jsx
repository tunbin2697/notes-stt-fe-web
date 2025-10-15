import { createContext, useContext, useState, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { LOGIN, LOGOUT, REGISTER, REFRESH_TOKEN } from "@/graphql/mutations";
import { GET_ME } from "@/graphql/queries";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken")
  );

  // Queries and mutations
  const {
    data: meData,
    refetch: refetchMe,
    loading: queryLoading,
    error: queryError,
  } = useQuery(GET_ME, {
    skip: !accessToken,
    fetchPolicy: "network-only",
  });

  // Update user and loading state when query data changes
  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      setUser(null);
      return;
    }

    if (queryLoading) {
      return;
    }

    if (queryError) {
      if (queryError.networkError) {
        localStorage.removeItem("accessToken");
        setAccessToken(null);
      }
      setLoading(false);
      setUser(null);
      return;
    }

    if (meData?.getMyProfile) {
      setUser(meData.getMyProfile);
      setLoading(false);
    }
  }, [accessToken, queryLoading, queryError, meData]);

  const [loginMutation] = useMutation(LOGIN);
  const [registerMutation] = useMutation(REGISTER);
  const [logoutMutation] = useMutation(LOGOUT);
  const [refreshMutation] = useMutation(REFRESH_TOKEN);

  // Set up token refresh interval
  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    // Refresh token every 14 minutes (tokens expire in 15 minutes)
    const refreshInterval = setInterval(() => {
      refreshToken();
    }, 14 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [accessToken]);

  const login = async (email, password) => {
    try {
      const { data } = await loginMutation({
        variables: { email, password },
      });

      if (data?.login?.accessToken) {
        const token = data.login.accessToken;
        localStorage.setItem("accessToken", token);
        setAccessToken(token);

        // Fetch user profile
        const { data: userData } = await refetchMe();
        setUser(userData.getMyProfile);

        return { success: true };
      }

      // If no access token in response
      return {
        success: false,
        error: "Login failed - no access token received",
      };
    } catch (error) {
      return {
        success: false,
        error: error.graphQLErrors?.[0]?.message || "Login failed",
      };
    }
  };

  const register = async (email, password) => {
    try {
      await registerMutation({
        variables: { email, password },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.graphQLErrors?.[0]?.message || "Registration failed",
      };
    }
  };

  const logout = async () => {
    try {
      await logoutMutation();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("accessToken");
      setAccessToken(null);
      setUser(null);
    }
  };

  const refreshToken = async () => {
    try {
      const { data } = await refreshMutation();
      if (data?.refresh?.accessToken) {
        const token = data.refresh.accessToken;
        localStorage.setItem("accessToken", token);
        setAccessToken(token);
        return true;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      await logout();
      return false;
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user && !!accessToken,
    login,
    register,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
