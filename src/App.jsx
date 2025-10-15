import { Routes, Route, Navigate } from "react-router-dom";
import { ApolloProvider } from "@apollo/client/react";
import { AuthProvider } from "@/contexts/AuthContext";
import apolloClient from "@/lib/apolloClient";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
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
