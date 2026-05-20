import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Loader2, Terminal } from "lucide-react";
import { API_BASE, apiUrl } from "../lib/api";

const SETUP_CONFIRMATION = "create-local-database";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function shouldRunLocalSetupGate() {
  try {
    const api = new URL(API_BASE, window.location.origin);
    return LOCAL_HOSTS.has(api.hostname) && LOCAL_HOSTS.has(window.location.hostname);
  } catch {
    return false;
  }
}

export default function DatabaseSetupGate({ children }) {
  const canRunLocalSetup = shouldRunLocalSetupGate();
  const [state, setState] = useState({
    loading: canRunLocalSetup,
    ready: !canRunLocalSetup,
    creating: false,
    denied: false,
    message: "",
    database: "silentlinesdiary",
  });

  useEffect(() => {
    if (!canRunLocalSetup) return;

    let active = true;

    fetch(apiUrl("/setup_status.php"), { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          return { status: "success", exists: true, database: data.database, skipped: true };
        }
        return data;
      })
      .then((data) => {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          ready: data.status === "success" && data.exists === true,
          database: data.database || current.database,
          message: data.status === "error" ? data.message || "Local database is not ready." : "",
        }));
      })
      .catch(() => {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          ready: false,
          message: "The local PHP API is not reachable. Start Apache/PHP and confirm VITE_API_BASE_URL points to your local php folder.",
        }));
      });

    return () => {
      active = false;
    };
  }, [canRunLocalSetup]);

  async function createDatabase() {
    setState((current) => ({ ...current, creating: true, message: "" }));
    try {
      const res = await fetch(apiUrl("/setup_database.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: SETUP_CONFIRMATION }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Could not create the local database.");
      }
      setState((current) => ({
        ...current,
        creating: false,
        ready: true,
        database: data.database || current.database,
        message: data.message || "Local database is ready.",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        creating: false,
        message: error.message || "Could not create the local database.",
      }));
    }
  }

  if (state.ready) {
    return children;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f3ec] px-4 py-10 text-stone-950">
      <section className="w-full max-w-2xl rounded-lg border border-amber-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            {state.loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Database className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Local setup</p>
            <h1 className="mt-1 text-2xl font-black">Prepare your local diary database</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-stone-600">
              Silent Lines needs a local MySQL database named <span className="font-black text-stone-900">{state.database}</span>.
              This setup runs only against localhost and does not connect to the production server.
            </p>
          </div>
        </div>

        {state.message && (
          <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{state.message}</p>
          </div>
        )}

        {state.denied ? (
          <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center gap-2 font-black text-stone-900">
              <Terminal className="h-5 w-5" />
              Run setup manually
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
              You can create the local database later from your terminal:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-950 p-4 text-xs font-bold text-stone-50">{`python scripts/setup_database.py
bash scripts/setup_database.sh`}</pre>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={createDatabase}
              disabled={state.loading || state.creating}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-black text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Yes, create local database
            </button>
            <button
              type="button"
              onClick={() => setState((current) => ({ ...current, denied: true }))}
              disabled={state.loading || state.creating}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-black text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
