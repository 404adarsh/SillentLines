import React, { useState, useEffect } from "react";
import { X, Search, UserPlus, Loader2, CheckCircle2, AlertCircle, Link as LinkIcon, Copy, Mail } from "lucide-react";
import { apiUrl } from "../lib/api";
import { loadTheme } from "../lib/themes";

export default function CollaboratorModal({ entryId, ownerEmail, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(null); // stores user id being invited
  const [message, setMessage] = useState({ type: "", text: "" });
  const [shareLink, setShareLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  // Debounced Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 2) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await fetch(apiUrl("/search_user.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchTerm, email: ownerEmail }),
      });
      const data = await readJson(res);
      if (data.status === "success") {
        const filteredUsers = data.users.filter(u => u.email !== ownerEmail);
        setResults(filteredUsers);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  const inviteUser = async (friendIdOrRecipient) => {
    setInviting(friendIdOrRecipient);
    setMessage({ type: "", text: "" });

    if (entryId && entryId.toString().length >= 13) {
      setMessage({
        type: "error",
        text: "Note is still syncing. Please wait a second and try again."
      });
      setInviting(null);
      return;
    }

    try {
      const payload = typeof friendIdOrRecipient === "number"
        ? { friend_id: friendIdOrRecipient }
        : { recipient: friendIdOrRecipient };

      const res = await fetch(apiUrl("/share_entry.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite",
          entry_id: entryId,
          owner_email: ownerEmail,
          ...payload,
        }),
      });

      const data = await readJson(res);

      if (data.status === "success") {
        setMessage({
          type: "success",
          text: data.message || "Invite sent successfully."
        });

        setResults(prev => prev.filter(u => Number(u.id) !== Number(friendIdOrRecipient)));
      } else {
        setMessage({
          type: "error",
          text: data.message || "Failed to send invitation."
        });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Could not send invitation."
      });
      console.error("Invite Error:", err);
    } finally {
      // 6. STOP LOADING SPINNER
      setInviting(null);
    }
  };

  const generateLink = async () => {
    setLinkLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch(apiUrl("/share_entry.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", entry_id: entryId, owner_email: ownerEmail, theme: loadTheme() }),
      });
      const data = await readJson(res);
      if (data.status !== "success") throw new Error(data.message || "Could not create share link.");
      const publicBase = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
      const nextLink = `${publicBase}/share/${data.token}`;
      setShareLink(nextLink);
      await navigator.clipboard?.writeText(nextLink);
      setMessage({ type: "success", text: "Share link copied. Anyone with this link can view this entry without registering." });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Could not create share link." });
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-stretch justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl animate-in fade-in zoom-in duration-300 sm:min-h-0 sm:max-h-[92dvh] sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="collaborator-title">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-stone-50">
          <div>
            <h3 id="collaborator-title" className="text-xl font-bold text-gray-800">Share entry</h3>
            <p className="text-xs text-gray-500 font-medium">Create a public link or notify a registered user</p>
          </div>
          <button onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition hover:bg-gray-200" aria-label="Close collaborator invite" title="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-6 rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white p-2 text-orange-600 shadow-sm">
                <LinkIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-stone-900">Public share link</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">People with the link can read this entry without signing in.</p>
                {shareLink && (
                  <input
                    readOnly
                    value={shareLink}
                    className="mt-3 w-full rounded-lg border border-orange-100 bg-white px-3 py-2 text-xs font-bold text-stone-600 outline-none"
                    aria-label="Generated public share link"
                  />
                )}
                <button
                  onClick={generateLink}
                  disabled={linkLoading}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-950 px-4 text-sm font-black text-white disabled:opacity-60"
                >
                  {linkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : shareLink ? <Copy className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                  {shareLink ? "Copy link" : "Generate link"}
                </button>
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              autoFocus
              type="text"
              aria-label="Search registered users by username"
              placeholder="Search username..."
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 border-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Feedback Message */}
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {/* Results List */}
          <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
            {searching ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : results.length > 0 ? (
              results.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 border border-gray-50 rounded-2xl hover:bg-orange-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{u.full_name}</p>
                      <p className="text-xs text-gray-500">@{u.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => inviteUser(Number(u.id))}
                    disabled={inviting === Number(u.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 text-sm font-black text-orange-600 shadow-sm transition-all hover:bg-orange-600 hover:text-white disabled:opacity-50"
                    aria-label={`Invite ${u.full_name || u.username} to collaborate`}
                  >
                    {inviting === Number(u.id) ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                    <span>Invite</span>
                  </button>
                </div>
              ))
            ) : message.type === "success" ? (
              <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-center">
                <CheckCircle2 className="mx-auto h-5 w-5 text-green-700" />
                <p className="mt-2 text-sm font-bold text-green-800">Share request is ready.</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-green-700">The recipient should check the notification bell after signing in.</p>
              </div>
            ) : searchTerm.length >= 2 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center">
                <p className="text-sm font-medium text-gray-400">No user found.</p>
                <button
                  onClick={() => inviteUser(searchTerm)}
                  disabled={inviting === searchTerm}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-black text-white disabled:opacity-60"
                >
                  {inviting === searchTerm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Try exact username
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-8 font-medium">Start typing to find a registered user...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

async function readJson(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text ? "Server returned an invalid response." : "Server returned an empty response." };
  }
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
}
