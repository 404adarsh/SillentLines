const AUTH0_DOMAIN_KEY = "silentlines_auth0_domain";
const AUTH0_CLIENT_ID_KEY = "silentlines_auth0_client_id";
const PLACEHOLDER_AUTH0_DOMAIN = "your-tenant.region.auth0.com";
const PLACEHOLDER_AUTH0_CLIENT_ID = "your_public_client_id";

function normalizeDomain(domain) {
  if (!domain) return "";
  let value = domain.trim();
  value = value.replace(/^https?:\/\//i, "");
  value = value.replace(/\/+$/, "");
  return value;
}

function storedValue(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function isPlaceholderValue(value) {
  if (!value) return false;
  const cleaned = value.trim();
  return (
    cleaned === PLACEHOLDER_AUTH0_DOMAIN ||
    cleaned === PLACEHOLDER_AUTH0_CLIENT_ID ||
    cleaned.toLowerCase().includes("your-tenant") ||
    cleaned.toLowerCase().includes("your_public_client_id") ||
    cleaned.toLowerCase().includes("your_public") ||
    cleaned.toLowerCase().includes("your_client")
  );
}

export function getAuth0Config() {
  const envDomain = isPlaceholderValue(import.meta.env.VITE_AUTH0_DOMAIN)
    ? ""
    : import.meta.env.VITE_AUTH0_DOMAIN;
  const envClientId = isPlaceholderValue(import.meta.env.VITE_AUTH0_CLIENT_ID)
    ? ""
    : import.meta.env.VITE_AUTH0_CLIENT_ID;

  const domain = normalizeDomain(
    envDomain || storedValue(AUTH0_DOMAIN_KEY) || ""
  );
  const clientId = (envClientId || storedValue(AUTH0_CLIENT_ID_KEY) || "").trim();

  return {
    domain,
    clientId,
    isConfigured: Boolean(domain && clientId),
    source: envDomain && envClientId ? "env" : "local",
  };
}

export function saveAuth0Config({ domain, clientId }) {
  try {
    window.localStorage.setItem(AUTH0_DOMAIN_KEY, normalizeDomain(domain));
    window.localStorage.setItem(AUTH0_CLIENT_ID_KEY, clientId.trim());
  } catch {
    // ignore localStorage write failures
  }
}
