import React, { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles, UnlockKeyhole } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { apiUrl, authUserPayload } from "../lib/api";

export default function LoginPage() {
  const [error, setError] = useState(null);
  const [lockState, setLockState] = useState("closed");
  const navigate = useNavigate();

  const {
    loginWithRedirect,
    user,
    isAuthenticated,
    isLoading,
    getAccessTokenSilently,
  } = useAuth0();

  // 🔒 BACKEND SYNC (ONLY AFTER AUTH0 LOGIN)
  useEffect(() => {
    const syncUserToDb = async () => {
      if (!isAuthenticated || !user || isLoading) return;

      try {
        const token = await getAccessTokenSilently();

        const response = await fetch(
          apiUrl("/login_handler.php"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              token,
              ...authUserPayload(user),
            }),
          }
        );

        if (!response.ok) {
          setError("Server error. Please try again.");
          return;
        }

        const data = await response.json();

        if (data.status === "success" || data.status === "created") {
          navigate("/moodselect");
        } else {
          setError(data.message || "Login failed.");
        }
      } catch {
        setError("Login sync failed. Please try again.");
      }
    };

    syncUserToDb();
  }, [isAuthenticated, user, isLoading, getAccessTokenSilently, navigate]);

  // 🔐 LOGIN HANDLERS
  const handleGoogleLogin = () => {
    setLockState("opening");
    loginWithRedirect({
      authorizationParams: {
        connection: "google-oauth2",
        scope: "openid profile email",
      },
    });
  };

  const handleEmailLogin = () => {
    setLockState("opening");
    loginWithRedirect({
      authorizationParams: {
        scope: "openid profile email",
      },
    });
  };

  const lockOpen = lockState === "opening" || isLoading || isAuthenticated;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3efe6] px-4 py-6 text-slate-950">
      <div className="absolute inset-0 pointer-events-none opacity-70">
        <div className="absolute left-0 top-0 h-full w-16 bg-[linear-gradient(90deg,rgba(120,53,15,0.14),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(#d9c7a8_1px,transparent_1px)] bg-[length:100%_34px]" />
      </div>

      {/* BACK BUTTON */}
      <button
        onClick={() => navigate("/")}
        className="relative z-20 mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white/80 px-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-amber-200 transition hover:bg-white"
        aria-label="Back to home page"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Home</span>
      </button>

      <div className="relative z-10 mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="hidden rounded-lg border border-amber-900/20 bg-[#4b2f22] p-5 text-white shadow-2xl lg:block" aria-label="Private diary lock preview">
          <div className="min-h-[560px] rounded-lg border border-amber-200/25 bg-[linear-gradient(135deg,#6b3f2a,#2d1b15)] p-7 shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-amber-200">SilentLines Vault</p>
                <h1 className="mt-2 text-4xl font-black leading-tight">Your diary opens only for you.</h1>
              </div>
              <BookOpen className="h-10 w-10 text-amber-200" />
            </div>
            <div className="mt-20 flex justify-center">
              <DiaryLock open={lockOpen} large />
            </div>
            <div className="mt-20 grid gap-3">
              {["Private writing", "Mood-safe memories", "AI review after login"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 text-sm font-bold">
                  <CheckCircle2 className="h-5 w-5 text-emerald-200" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-amber-300 bg-white/95 p-5 shadow-2xl sm:p-8" aria-labelledby="login-title">
          <div className="text-center">
            <DiaryLock open={lockOpen} />
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-amber-800">
              <ShieldCheck className="h-4 w-4" />
              Secure diary login
            </p>
            <h1 id="login-title" className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              {lockOpen ? "Unlocking..." : "Open your diary"}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500">
              {isLoading ? "Checking your safe session." : "Use Google or email to unlock your private SilentLines space."}
            </p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
              aria-label="Continue with Google"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-amber-200" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">or</span>
              <div className="h-px flex-1 bg-amber-200" />
            </div>

            <button
              onClick={handleEmailLogin}
              disabled={isLoading}
              className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-slate-950 px-5 text-sm font-black text-white shadow-lg transition hover:bg-amber-800 disabled:opacity-50"
              aria-label="Continue with email"
            >
              <Mail className="h-5 w-5" />
              <span>Continue with Email</span>
            </button>
          </div>

          <p className="mt-8 text-center text-[11px] font-semibold uppercase leading-5 tracking-wide text-slate-400">
            By using SilentLines, you agree to our{" "}
            <Link to="/privacypolicy" className="underline underline-offset-2 hover:text-amber-700">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/termscondition" className="underline underline-offset-2 hover:text-amber-700">
              Terms & Conditions
            </Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

function DiaryLock({ open, large = false }) {
  return (
    <div className={`mx-auto flex items-center justify-center ${large ? "h-48 w-48" : "h-28 w-28"}`} aria-hidden="true">
      <div className={`relative rounded-lg border border-amber-200 bg-white shadow-2xl ${large ? "h-40 w-40" : "h-24 w-24"}`}>
        <div className={`absolute left-1/2 top-0 h-16 w-20 -translate-x-1/2 -translate-y-8 rounded-t-full border-[10px] border-slate-800 border-b-0 transition-transform duration-700 ${open ? "-rotate-12 -translate-y-11 translate-x-[-35%]" : ""}`} />
        <div className="absolute inset-3 rounded-lg bg-[linear-gradient(135deg,#fef3c7,#f8fafc)] ring-1 ring-amber-200" />
        <div className="absolute inset-0 flex items-center justify-center">
          {open ? (
            <UnlockKeyhole className={`${large ? "h-16 w-16" : "h-10 w-10"} animate-pulse text-emerald-700`} />
          ) : (
            <LockKeyhole className={`${large ? "h-16 w-16" : "h-10 w-10"} text-amber-800`} />
          )}
        </div>
        <Sparkles className="absolute -right-3 top-4 h-5 w-5 animate-pulse text-amber-500" />
        <KeyRound className="absolute -bottom-4 left-1/2 h-7 w-7 -translate-x-1/2 text-amber-700" />
      </div>
    </div>
  );
}
