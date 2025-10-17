import { Routes, Route, Navigate } from "react-router-dom";
import { ApolloProvider } from "@apollo/client/react";
import { AuthProvider } from "@/contexts/AuthContext";
import apolloClient from "@/lib/apolloClient";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ChangePassword from "@/pages/ChangePassword";
import LogoutAll from "@/pages/LogoutAll";
import Profile from "@/pages/Profile";
import Notes from "@/pages/Notes";
import Test from "@/pages/Test";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/notes" replace /> : children;
}

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/notes" replace />} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfAuthenticated>
                <Register />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <RedirectIfAuthenticated>
                <ForgotPassword />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/reset-password"
            element={
              <RedirectIfAuthenticated>
                <ResetPassword />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logout-all"
            element={
              <ProtectedRoute>
                <LogoutAll />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <Notes />
              </ProtectedRoute>
            }
          />
          <Route path="/test" element={<Test />} />
        </Routes>
      </AuthProvider>
    </ApolloProvider>
  );
}

export default App;
