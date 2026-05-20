import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { KeyRound, Loader2, LockKeyhole, Mail, UnlockKeyhole } from "lucide-react";
import { useLocation } from "react-router-dom";
import { apiUrl, authUserPayload, postJson } from "../lib/api";
import WorkspaceSettings, { defaultWorkspacePrefs, normalizePrefs, savePrefsLocal } from "./WorkspaceSettings";
import { todayIndiaInput } from "../lib/format";

const VERIFIED_STATUSES = new Set(["success", "exists", "created", "ok"]);

export default function EnsureUserGate({ children }) {
  const { isAuthenticated, isLoading, user, getAccessTokenSilently } = useAuth0();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState(defaultWorkspacePrefs);
  const [lockReady, setLockReady] = useState(false);
  const [lockSettings, setLockSettings] = useState(null);
  const [lockPassword, setLockPassword] = useState("");
  const [lockError, setLockError] = useState("");
  const [lockMessage, setLockMessage] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [resettingLock, setResettingLock] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const ensureUser = async () => {
      if (!isLoading && isAuthenticated && !user) {
        if (!cancelled) {
          setError("Could not restore your profile. Please log in again.");
          setReady(true);
          setPrefsReady(true);
          setLockReady(true);
        }
        return;
      }

      if (!isAuthenticated || !user || isLoading) return;

      const loadPreferences = async () => {
        try {
          const prefRes = await fetch(`${apiUrl("/user_preferences.php")}?email=${encodeURIComponent(user.email || "")}`, {
            credentials: "include",
          });
          const prefData = await prefRes.json().catch(() => ({}));

          if (cancelled) return;

          if (prefData.status === "success" && prefData.has_preferences) {
            savePrefsLocal(normalizePrefs(prefData.preferences));
          } else {
            setShowPrefs(true);
          }
        } catch (prefError) {
          console.warn("Preferences load failed:", prefError);
        } finally {
          if (!cancelled) setPrefsReady(true);
        }
      };

      try {
        let token = "";
        try {
          token = await getAccessTokenSilently();
        } catch (tokenError) {
          console.warn("Auth token unavailable during user verification:", tokenError);
        }

        const payload = { token, ...authUserPayload(user) };
        const res = await fetch(
          apiUrl("/ensure_user.php"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );

        const data = await res.json().catch(() => ({}));

        if (res.ok && VERIFIED_STATUSES.has(data.status)) {
          if (cancelled) return;
          setReady(true);
          await loadPreferences();
          return;
        }

        const fallbackRes = await fetch(
          apiUrl("/login_handler.php"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );
        const fallbackData = await fallbackRes.json().catch(() => ({}));

        if (fallbackRes.ok && VERIFIED_STATUSES.has(fallbackData.status)) {
          if (cancelled) return;
          setReady(true);
          await loadPreferences();
          return;
        }

        if (!cancelled) {
          setError(data.message || fallbackData.message || "Failed to verify user profile.");
          setReady(true);
          setPrefsReady(true);
        }
      } catch (verifyError) {
        console.warn("User verification failed:", verifyError);
        if (!cancelled) {
          setError("User verification failed. You can still try saving.");
          setReady(true);
          setPrefsReady(true);
        }
      }
    };

    ensureUser();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, isLoading, getAccessTokenSilently]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    const loadLock = async () => {
      if (!isAuthenticated || !user?.email || !ready) {
        if (!cancelled && ready) setLockReady(true);
        return;
      }
      try {
        const res = await fetch(`${apiUrl("/diary_lock.php")}?email=${encodeURIComponent(user.email)}&path=${encodeURIComponent(location.pathname)}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.status === "success") setLockSettings(data.settings);
      } catch {
        if (!cancelled) setLockSettings({ is_enabled: 0, prompt_frequency: "every_visit" });
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLockReady(true);
      }
    };

    loadLock();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isAuthenticated, user?.email, ready, location.pathname]);

  useEffect(() => {
    const handleLockUpdate = (event) => {
      if (event.detail?.settings) setLockSettings(event.detail.settings);
      clearLockUnlocks(user?.email);
    };

    window.addEventListener("silentlines-lock-updated", handleLockUpdate);
    return () => window.removeEventListener("silentlines-lock-updated", handleLockUpdate);
  }, [user?.email]);

  const shouldAskLock = () => {
    if (!lockSettings || Number(lockSettings.is_enabled) !== 1 || !user?.email) return false;
    const frequency = lockSettings.prompt_frequency || "every_visit";
    if (frequency === "entry_open" && !location.pathname.startsWith("/edit/")) return false;
    return Number(lockSettings.unlocked) !== 1;
  };

  const verifyLock = async () => {
    if (!user?.email || !lockPassword.trim()) return;
    setUnlocking(true);
    setLockError("");
    setLockMessage("");
    try {
      const data = await postJson("/diary_lock.php", {
        action: "verify",
        email: user.email,
        password: lockPassword,
        path: location.pathname,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not unlock diary.");
      if (data.settings) setLockSettings(data.settings);
      setLockPassword("");
    } catch (err) {
      setLockError(err.message || "Diary password is incorrect.");
    } finally {
      setUnlocking(false);
    }
  };

  const lockRequired = shouldAskLock();

  const sendNewLockPassword = async () => {
    if (!user?.email || resettingLock) return;
    setResettingLock(true);
    setLockError("");
    setLockMessage("");
    try {
      const data = await postJson("/diary_lock.php", {
        action: "forgot_password",
        email: user.email,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not send a new diary password.");
      if (data.settings) {
        setLockSettings(data.settings);
        clearLockUnlocks(user.email);
        window.dispatchEvent(new CustomEvent("silentlines-lock-updated", { detail: { settings: data.settings } }));
      }
      setLockPassword("");
      const remainingText = Number.isFinite(Number(data.resets_remaining))
        ? ` ${data.resets_remaining} reset${Number(data.resets_remaining) === 1 ? "" : "s"} left this month.`
        : "";
      setLockMessage(`${data.message || "A new diary password has been sent to your registered email."}${remainingText}`);
    } catch (err) {
      setLockError(err.message || "Could not send a new diary password.");
    } finally {
      setResettingLock(false);
    }
  };

  // 🔄 LOADER
  if (isLoading || !ready || !prefsReady || !lockReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          <p className="text-sm text-gray-600">
            Preparing your space…
          </p>
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (lockRequired) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950 p-4" role="dialog" aria-modal="true" aria-labelledby="diary-lock-title">
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-amber-300 bg-[#fff9eb] shadow-2xl">
            <div className="bg-[#3b261b] p-6 text-center text-white">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-900 shadow-xl">
                {unlocking ? <UnlockKeyhole className="h-11 w-11 animate-pulse text-emerald-700" /> : <LockKeyhole className="h-11 w-11" />}
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-200">Diary Lock</p>
              <h2 id="diary-lock-title" className="mt-2 text-3xl font-black">Unlock your diary</h2>
              <p className="mt-2 text-sm font-semibold text-white/70">{lockSettings?.recovery_hint || "Enter your private diary password to continue."}</p>
            </div>
            <div className="p-5">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Diary Password
                <input
                  type="password"
                  value={lockPassword}
                  onChange={(event) => setLockPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") verifyLock();
                  }}
                  className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  aria-label="Diary lock password"
                  autoFocus
                />
              </label>
              <button
                type="button"
                onClick={sendNewLockPassword}
                disabled={resettingLock}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-black text-amber-800 hover:text-amber-950 disabled:opacity-60"
                aria-label="Send a new diary password to my registered email"
              >
                {resettingLock ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Forgot password?
              </button>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                You can receive a new diary password up to 3 times per month.
              </p>
              {lockError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{lockError}</p>}
              {lockMessage && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status">{lockMessage}</p>}
              <button onClick={verifyLock} disabled={unlocking || !lockPassword.trim()} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50" aria-label="Unlock diary">
                {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Unlock Diary
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {showPrefs && (
        <WorkspaceSettings userEmail={user?.email} prefs={prefs} setPrefs={setPrefs} onClose={() => setShowPrefs(false)} forceOpen />
      )}
    </>
  );
}

function lockStorageKey(email, frequency) {
  return `silentlines_diary_unlocked:${email}:${frequency}`;
}

function lockToken(frequency, settings = {}) {
  const version = settings.last_changed_at || settings.updated_at || "current";
  if (frequency === "daily") return `${version}:${todayIndiaInput()}`;
  if (frequency === "entry_open") return `${version}:${window.location.pathname}`;
  return `${version}:session`;
}

function lockStorage(frequency) {
  try {
    const storage = frequency === "every_visit" ? window.sessionStorage : window.localStorage;
    const testKey = "__silentlines_storage_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    return memoryStorage;
  }
}

function clearLockUnlocks(email) {
  if (!email) return;
  [lockStorage("every_visit"), lockStorage("daily")].forEach((storage) => {
    ["every_visit", "daily", "entry_open"].forEach((frequency) => {
      storage.removeItem(lockStorageKey(email, frequency));
    });
  });
}

const memoryStore = new Map();
const memoryStorage = {
  getItem: (key) => memoryStore.get(key) || null,
  setItem: (key, value) => memoryStore.set(key, String(value)),
  removeItem: (key) => memoryStore.delete(key),
};
