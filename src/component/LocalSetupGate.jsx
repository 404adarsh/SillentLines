import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Server, ShieldCheck } from "lucide-react";
import { API_BASE, apiUrl, postJson } from "../lib/api";
import { getAuth0Config, saveAuth0Config } from "../lib/authConfig";

const BACKEND_DONE_KEY = "silentlines_backend_config_done";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalApi() {
  try {
    const api = new URL(API_BASE, window.location.origin);
    return LOCAL_HOSTS.has(api.hostname) && LOCAL_HOSTS.has(window.location.hostname);
  } catch {
    return false;
  }
}

function backendDone() {
  try {
    return window.localStorage.getItem(BACKEND_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markBackendDone() {
  try {
    window.localStorage.setItem(BACKEND_DONE_KEY, "1");
  } catch {
    // localStorage can be disabled; setup should still continue for this tab.
  }
}

export default function LocalSetupGate({ children }) {
  const initialAuth = useMemo(() => getAuth0Config(), []);
  const isAuthCallback =
    new URLSearchParams(window.location.search).has("code") &&
    new URLSearchParams(window.location.search).has("state");
  const [authDomain, setAuthDomain] = useState(initialAuth.domain);
  const [authClientId, setAuthClientId] = useState(initialAuth.clientId);
  const [checkingBackend, setCheckingBackend] = useState(isLocalApi() && !backendDone() && !isAuthCallback);
  const [needsBackendConfig, setNeedsBackendConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [backend, setBackend] = useState({
    alchemyApiKey: "",
    sarvamApiKey: "",
    sarvamModel: "sarvam-30b",
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: "tls",
    smtpUser: "",
    smtpPass: "",
    mailFrom: "",
    mailFromName: "SilentLines",
  });
  const [currentSearch, setCurrentSearch] = useState(window.location.search);

  useEffect(() => {
    const updateSearch = () => setCurrentSearch(window.location.search);
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      updateSearch();
      return result;
    };

    window.history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      updateSearch();
      return result;
    };

    window.addEventListener("popstate", updateSearch);
    return () => {
      window.removeEventListener("popstate", updateSearch);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  const forceSetupOpen = new URLSearchParams(currentSearch).get("force_setup") === "1";

  useEffect(() => {
    if (!isLocalApi() || backendDone() || isAuthCallback) return;
    let active = true;

    fetch(apiUrl("/setup_config.php"), { credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!active) return;

        if (data.status === "success") {
          const fetchedAuthDomain = data.config?.auth0_domain || "";
          const fetchedAuthClientId = data.config?.auth0_client_id || "";

          setAuthDomain((current) => current || fetchedAuthDomain);
          setAuthClientId((current) => current || fetchedAuthClientId);

          setBackend((current) => ({
            ...current,
            alchemyApiKey: data.config?.alchemy_api_key || "",
            sarvamApiKey: data.config?.sarvam_api_key || "",
            sarvamModel: data.config?.sarvam_model || "sarvam-30b",
            openaiApiKey: data.config?.openai_api_key || "",
            openaiModel: data.config?.openai_model || "gpt-4o-mini",
            smtpHost: data.config?.diary_smtp_host || "",
            smtpPort: data.config?.diary_smtp_port || "587",
            smtpSecure: data.config?.diary_smtp_secure || "tls",
            smtpUser: data.config?.diary_smtp_user || "",
            smtpPass: data.config?.diary_smtp_pass || "",
            mailFrom: data.config?.diary_mail_from || "",
            mailFromName: data.config?.diary_mail_from_name || "SilentLines",
          }));
        }

        const missingImportant =
          data.status === "success" &&
          (!data.configured?.alchemy_api_key || !data.configured?.sarvam_api_key || !data.configured?.auth0);
        setNeedsBackendConfig(Boolean(missingImportant));
        setCheckingBackend(false);
      })
      .catch(() => {
        if (!active) return;
        setNeedsBackendConfig(false);
        setCheckingBackend(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthCallback]);

  const needsAuthConfig = !authDomain.trim() || !authClientId.trim();
  const showBackendFields = forceSetupOpen || needsBackendConfig;
  const shouldShow = forceSetupOpen || needsAuthConfig || needsBackendConfig || checkingBackend;

  if (!shouldShow) return children;

  async function saveSetup() {
    setMessage("");

    if (needsAuthConfig && (!authDomain.trim() || !authClientId.trim())) {
      setMessage("Auth0 domain and client ID are required for login.");
      return;
    }

    setSaving(true);
    try {
      if (authDomain.trim() && authClientId.trim()) {
        saveAuth0Config({ domain: authDomain, clientId: authClientId });
      }

      if (needsBackendConfig || isLocalApi()) {
        await postJson("/setup_config.php", {
          auth0_domain: authDomain,
          auth0_client_id: authClientId,
          alchemy_api_key: backend.alchemyApiKey,
          sarvam_api_key: backend.sarvamApiKey,
          sarvam_model: backend.sarvamModel,
          openai_api_key: backend.openaiApiKey,
          openai_model: backend.openaiModel,
          diary_smtp_host: backend.smtpHost,
          diary_smtp_port: backend.smtpPort,
          diary_smtp_secure: backend.smtpSecure,
          diary_smtp_user: backend.smtpUser,
          diary_smtp_pass: backend.smtpPass,
          diary_mail_from: backend.mailFrom,
          diary_mail_from_name: backend.mailFromName,
        });
        if (needsBackendConfig) {
          markBackendDone();
        }
      }

      const query = new URLSearchParams(window.location.search);
      query.delete("force_setup");
      const queryString = query.toString();
      const path = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
      window.location.replace(path);
    } catch (error) {
      setMessage(error.message || "Could not save local setup.");
      setSaving(false);
    }
  }

  function skipBackend() {
    markBackendDone();
    setNeedsBackendConfig(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] px-4 py-10 text-stone-950">
      <section className="mx-auto w-full max-w-3xl rounded-lg border border-amber-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-950 text-white">
            {checkingBackend ? <Loader2 className="h-6 w-6 animate-spin" /> : <KeyRound className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Local setup</p>
            <h1 className="mt-1 text-2xl font-black">Connect your own Auth0 and API keys</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-stone-600">
              Before the diary can open, you must provide Auth0 login details and local backend API keys. This setup is only for your local copy, and private keys are never committed to source control.
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              If this is your first visit, the site will ask you for your own keys and save them locally in `php/secrets.php` and browser storage.
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Need help? Get the Domain and Client ID from Auth0 Dashboard → Applications → your Single Page Application → Settings. Use the hostname only and set the callback to <span className="font-mono">http://localhost:2228/login</span>. See <a className="font-bold text-amber-900 underline" href="https://auth0.com/docs/quickstart/spa/react" target="_blank" rel="noreferrer">Auth0 SPA quickstart</a>.
            </p>
          </div>
        </div>

        {checkingBackend ? (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm font-bold text-stone-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking local backend config...
          </div>
        ) : (
          <div className="mt-6 grid gap-6">
            <fieldset className="grid gap-3 rounded-lg border border-stone-200 p-4">
              <legend className="flex items-center gap-2 px-2 text-sm font-black text-stone-900">
                <ShieldCheck className="h-4 w-4" />
                Auth0 login
              </legend>
              <p className="text-sm text-stone-600">
                Enter your Auth0 Domain and Client ID. Use only the hostname (for example, <span className="font-mono">your-tenant.region.auth0.com</span>), not a URL.
              </p>
              <SetupInput label="Auth0 domain" value={authDomain} onChange={setAuthDomain} placeholder="your-tenant.region.auth0.com" />
              <SetupInput label="Auth0 client ID" value={authClientId} onChange={setAuthClientId} placeholder="public SPA client ID" />
            </fieldset>

            {showBackendFields && (
              <fieldset className="grid gap-3 rounded-lg border border-stone-200 p-4">
                <legend className="flex items-center gap-2 px-2 text-sm font-black text-stone-900">
                  <Server className="h-4 w-4" />
                  Backend API keys
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SetupInput label="Alchemy API key" value={backend.alchemyApiKey} onChange={(value) => setBackend((current) => ({ ...current, alchemyApiKey: value }))} />
                  <SetupInput label="Sarvam API key" value={backend.sarvamApiKey} onChange={(value) => setBackend((current) => ({ ...current, sarvamApiKey: value }))} />
                  <SetupInput label="Sarvam model" value={backend.sarvamModel} onChange={(value) => setBackend((current) => ({ ...current, sarvamModel: value }))} />
                  <SetupInput label="OpenAI API key" value={backend.openaiApiKey} onChange={(value) => setBackend((current) => ({ ...current, openaiApiKey: value }))} />
                  <SetupInput label="OpenAI model" value={backend.openaiModel} onChange={(value) => setBackend((current) => ({ ...current, openaiModel: value }))} />
                </div>
                <details className="rounded-lg bg-stone-50 p-3">
                  <summary className="cursor-pointer text-sm font-black text-stone-700">Email reset settings</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <SetupInput label="SMTP host" value={backend.smtpHost} onChange={(value) => setBackend((current) => ({ ...current, smtpHost: value }))} />
                    <SetupInput label="SMTP port" value={backend.smtpPort} onChange={(value) => setBackend((current) => ({ ...current, smtpPort: value }))} />
                    <SetupInput label="SMTP secure" value={backend.smtpSecure} onChange={(value) => setBackend((current) => ({ ...current, smtpSecure: value }))} />
                    <SetupInput label="SMTP user" value={backend.smtpUser} onChange={(value) => setBackend((current) => ({ ...current, smtpUser: value }))} />
                    <SetupInput label="SMTP password" type="password" value={backend.smtpPass} onChange={(value) => setBackend((current) => ({ ...current, smtpPass: value }))} />
                    <SetupInput label="Mail from" value={backend.mailFrom} onChange={(value) => setBackend((current) => ({ ...current, mailFrom: value }))} />
                    <SetupInput label="Mail from name" value={backend.mailFromName} onChange={(value) => setBackend((current) => ({ ...current, mailFromName: value }))} />
                  </div>
                </details>
              </fieldset>
            )}

            {message && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
                {message}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={saveSetup}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save setup
              </button>
              {needsBackendConfig && (
                <button
                  type="button"
                  onClick={skipBackend}
                  disabled={saving || needsAuthConfig}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-black text-stone-700 disabled:opacity-60"
                >
                  Skip backend keys
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function SetupInput({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-widest text-stone-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-stone-950 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
      />
    </label>
  );
}
