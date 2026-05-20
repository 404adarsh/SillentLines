import { Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import AuthLoading from "./AuthLoading";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <AuthLoading />;

  return isAuthenticated ? children : <Navigate to="/" replace />;
}
