import { Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import AuthLoading from "./AuthLoading";

export default function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <AuthLoading />;

  // 🔁 If already logged in → go to moodselect
  if (isAuthenticated) {
    return <Navigate to="/moodselect" replace />;
  }

  return children;
}
