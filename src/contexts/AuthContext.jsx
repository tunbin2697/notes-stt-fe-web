import { createContext, useContext, useState, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  LOGIN,
  LOGOUT,
  REGISTER,
  REFRESH_TOKEN,
  CHANGE_PASSWORD,
  UPDATE_PROFILE,
  REQUEST_LOGOUT_ALL_OTP,
  LOGOUT_ALL,
} from "@/graphql/mutations";
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
  const [initialCheckDone, setInitialCheckDone] = useState(false);

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

  // Initial token refresh check on app load
  useEffect(() => {
    const checkInitialAuth = async () => {
      const storedToken = localStorage.getItem("accessToken");

      // If no token, try to refresh from cookie
      if (!storedToken) {
        console.log(
          "No accessToken found, attempting to refresh from cookie..."
        );
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
            const newToken = result.data.refresh.accessToken;
            localStorage.setItem("accessToken", newToken);
            setAccessToken(newToken);
            console.log("Token refreshed successfully on app load");
          } else {
            console.log("No valid refresh token available");
            setLoading(false);
          }
        } catch (error) {
          console.error("Initial token refresh failed:", error);
          setLoading(false);
        }
      }

      setInitialCheckDone(true);
    };

    if (!initialCheckDone) {
      checkInitialAuth();
    }
  }, [initialCheckDone]);

  // Update user and loading state when query data changes
  useEffect(() => {
    // Wait for initial token check to complete
    if (!initialCheckDone) {
      return;
    }

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
  }, [initialCheckDone, accessToken, queryLoading, queryError, meData]);

  const [loginMutation] = useMutation(LOGIN);
  const [registerMutation] = useMutation(REGISTER);
  const [logoutMutation] = useMutation(LOGOUT);
  const [refreshMutation] = useMutation(REFRESH_TOKEN);
  const [changePasswordMutation] = useMutation(CHANGE_PASSWORD);
  const [updateProfileMutation] = useMutation(UPDATE_PROFILE);
  const [requestLogoutAllOTPMutation] = useMutation(REQUEST_LOGOUT_ALL_OTP);
  const [logoutAllMutation] = useMutation(LOGOUT_ALL);

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
        error:
          error.graphQLErrors?.[0]?.message || error.message || "Login failed",
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
        error:
          error.graphQLErrors?.[0]?.message ||
          error.message ||
          "Registration failed",
      };
    }
  };

  const logout = async () => {
    try {
      await logoutMutation();
    } catch (error) {
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

  const changePassword = async (oldPassword, newPassword) => {
    try {
      await changePasswordMutation({
        variables: { oldPassword, newPassword },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error.graphQLErrors?.[0]?.message ||
          error.message ||
          "Failed to change password",
      };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      await updateProfileMutation({
        variables: profileData,
      });
      // Refetch user profile after successful update
      const { data: userData } = await refetchMe();
      if (userData?.getMyProfile) {
        setUser(userData.getMyProfile);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error.graphQLErrors?.[0]?.message ||
          error.message ||
          "Failed to update profile",
      };
    }
  };

  const requestLogoutAllOTP = async (email) => {
    try {
      await requestLogoutAllOTPMutation({
        variables: { email },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error.graphQLErrors?.[0]?.message ||
          error.message ||
          "Failed to request logout OTP",
      };
    }
  };

  const logoutAll = async (email, otp) => {
    try {
      await logoutAllMutation({
        variables: { email, otp },
      });
      // Clear local session after logging out from all devices
      localStorage.removeItem("accessToken");
      setAccessToken(null);
      setUser(null);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error.graphQLErrors?.[0]?.message ||
          error.message ||
          "Failed to logout from all devices",
      };
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
    changePassword,
    updateProfile,
    requestLogoutAllOTP,
    logoutAll,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
