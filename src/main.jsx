import React from "react";
import ReactDOM from "react-dom/client";
import { Auth0Context, Auth0Provider } from "@auth0/auth0-react";
import App from "./App";
import "./index.css";
import { HelmetProvider } from "react-helmet-async";
import { registerSW } from 'virtual:pwa-register'
import LocalSetupGate from "./component/LocalSetupGate";
import { getAuth0Config } from "./lib/authConfig";
registerSW({ immediate: true })

const auth0Unavailable = {
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  error: undefined,
  loginWithRedirect: async () => {
    throw new Error("Auth0 is not configured for this local copy.");
  },
  getAccessTokenSilently: async () => "",
  logout: () => {},
};

function AuthProvider({ children }) {
  const auth0Config = getAuth0Config();

  if (!auth0Config.isConfigured) {
    return (
      <Auth0Context.Provider value={auth0Unavailable}>
        {children}
      </Auth0Context.Provider>
    );
  }

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      cacheLocation="localstorage"
      useRefreshTokens
      useRefreshTokensFallback
      onRedirectCallback={(appState) => {
        const returnTo = appState?.returnTo || "/moodselect";
        const targetPath = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
        if (window.location.pathname !== targetPath) {
          window.location.replace(targetPath);
        }
      }}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/login`,
        scope: "openid profile email offline_access",
      }}
    >
      {children}
    </Auth0Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <LocalSetupGate>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LocalSetupGate>
  </HelmetProvider>
);
