import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

const RedirectNonuser = () => {
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    // NOT logged in → HOME
    if (isAuthenticated) {
      navigate("/moodselect", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return null;
};

export default RedirectNonuser;
