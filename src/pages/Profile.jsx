import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { 
  User, Mail, Calendar,
  LogOut, ArrowLeft, Loader2, ShieldCheck, Save, AlertCircle, CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiUrl, postJson } from "../lib/api";
import { formatIndiaDate } from "../lib/format";

export default function Profile() {
  const { user, isAuthenticated, isLoading, logout } = useAuth0();
  const [dbUser, setDbUser] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState({ type: "", text: "" });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isAuthenticated || !user?.email) return;

      try {
        const res = await fetch(apiUrl("/get_user_profile.php"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email })
        });

        const data = await res.json();

        if (data.status === "success") {
          setDbUser(data.user);
          setUsernameDraft(data.user?.username || "");
        } else {
          console.error("User not found in DB:", data.message);
        }
      } catch (error) {
        console.error("Network error fetching profile:", error);
      } finally {
        setFetching(false);
      }
    };

    fetchUserProfile();
  }, [isAuthenticated, user]);

  // Loading State
  if (isLoading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Not Authenticated State
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
        <p className="text-gray-500 mt-2">Please log in to view your profile.</p>
      </div>
    );
  }

  // Helper to format dates nicely
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return formatIndiaDate(dateString, { day: "numeric", month: "long", year: "numeric" });
  };

  const cleanUsername = (value) => value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);

  const changeUsername = async () => {
    if (!user?.email || savingUsername) return;
    setSavingUsername(true);
    setUsernameMessage({ type: "", text: "" });
    try {
      const data = await postJson("/update_username.php", {
        email: user.email,
        username: usernameDraft,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not change username.");
      setDbUser((current) => ({ ...current, ...data.user }));
      setUsernameDraft(data.user?.username || usernameDraft);
      setUsernameMessage({
        type: "success",
        text: `${data.message || "Username changed."} You can change it again after ${formatDate(data.next_change_at)}.`,
      });
    } catch (err) {
      setUsernameMessage({ type: "error", text: err.message || "Could not change username." });
    } finally {
      setSavingUsername(false);
    }
  };

  const canChangeUsername = Boolean(dbUser?.can_change_username);
  const usernameUnchanged = cleanUsername(usernameDraft) === (dbUser?.username || "");

  return (
    <div className="min-h-screen bg-[#fafaf9] p-6 relative">
      {/* Background Decorative Gradient */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-b-[3rem] shadow-xl" />

      <div className="relative max-w-2xl mx-auto mt-8">
        {/* Header Navigation */}
        <div className="flex justify-between items-center text-white mb-8 px-2">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 hover:bg-white/20 px-4 py-2 rounded-full transition-all"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-xl font-semibold tracking-wider uppercase">My Profile</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>

        {/* Main Profile Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center -mt-12 pt-16 pb-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200">
                <img 
                  src={user.picture} 
                  alt={user.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              <div className="absolute bottom-1 right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center" title="Verified via Auth0">
                 <ShieldCheck className="w-3 h-3 text-white" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mt-4">{dbUser?.full_name || user.name}</h2>
            <p className="text-gray-500 font-medium text-sm bg-gray-100 px-3 py-1 rounded-full mt-2">
              @{dbUser?.username || "diary_user"}
            </p>
          </div>

          <div className="border-t border-gray-100" />

          {/* Details Grid */}
          <div className="p-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Account Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Email */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
                <div className="bg-white p-2.5 rounded-xl shadow-sm text-indigo-600">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-indigo-900/60 font-bold uppercase">Email Address</p>
                  <p className="text-gray-800 font-medium text-sm">Hidden for privacy</p>
                </div>
              </div>

              {/* Username (DB) */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-purple-50/50 hover:bg-purple-50 transition-colors">
                <div className="bg-white p-2.5 rounded-xl shadow-sm text-purple-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-purple-900/60 font-bold uppercase">Username</p>
                  <p className="text-gray-800 font-medium text-sm">{dbUser?.username || "Not Set"}</p>
                </div>
              </div>

              {/* Joined Date */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-orange-50/50 hover:bg-orange-50 transition-colors">
                <div className="bg-white p-2.5 rounded-xl shadow-sm text-orange-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-orange-900/60 font-bold uppercase">Member Since</p>
                  <p className="text-gray-800 font-medium text-sm">
                    {dbUser?.created_at ? formatDate(dbUser.created_at) : "Unknown"}
                  </p>
                </div>
              </div>

            </div>

            <div className="mt-8 rounded-2xl border border-purple-100 bg-purple-50/60 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 text-purple-700 shadow-sm">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-widest text-purple-900/60">Change Username</p>
                  <h3 className="mt-1 text-lg font-black text-gray-900">@{dbUser?.username || "diary_user"}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">
                    You can change your username once in a year. Collaborations, linked people, notifications, and diary history will be updated to the new username.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="text-xs font-black uppercase tracking-widest text-purple-900/60">
                  New username
                  <input
                    value={usernameDraft}
                    onChange={(event) => setUsernameDraft(cleanUsername(event.target.value))}
                    disabled={!canChangeUsername || savingUsername}
                    placeholder="your_username"
                    className="mt-2 w-full rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:ring-4 focus:ring-purple-100 disabled:opacity-60"
                    aria-label="New username"
                  />
                </label>
                <button
                  onClick={changeUsername}
                  disabled={!canChangeUsername || usernameUnchanged || usernameDraft.length < 3 || savingUsername}
                  className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-xl bg-purple-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-purple-800 disabled:opacity-50"
                  aria-label="Change username"
                >
                  {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Username
                </button>
              </div>

              {!canChangeUsername && dbUser?.next_username_change_at && (
                <p className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-purple-900">
                  Next username change available after {formatDate(dbUser.next_username_change_at)}.
                </p>
              )}

              {usernameMessage.text && (
                <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm font-bold ${
                  usernameMessage.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                }`}>
                  {usernameMessage.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{usernameMessage.text}</span>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <div className="mt-10">
              <button
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                className="w-full py-4 rounded-xl border border-red-100 bg-red-50 text-red-600 font-bold flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all shadow-sm hover:shadow-lg active:scale-95"
              >
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
