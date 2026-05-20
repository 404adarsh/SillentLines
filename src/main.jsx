import React from "react";
import ReactDOM from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App";
import "./index.css";
import { HelmetProvider } from "react-helmet-async";
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN || "dev-placeholder.auth0.com";
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID || "dev-placeholder-client-id";

ReactDOM.createRoot(document.getElementById("root")).render(
  <HelmetProvider>
  <Auth0Provider
    domain={auth0Domain}
    clientId={auth0ClientId}
    cacheLocation="localstorage"
    useRefreshTokens
    useRefreshTokensFallback
    authorizationParams={{
      redirect_uri: window.location.origin,
      scope: "openid profile email"
    }}
  >
    <App />
  </Auth0Provider>
  </HelmetProvider>

);
