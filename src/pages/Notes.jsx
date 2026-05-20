import React, { useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { AlertCircle, Archive, ArchiveRestore, ArrowRight, CheckCircle2, PenLine, Search, Loader2, Calendar as CalendarIcon, List, BookOpen, Sparkles, GitCommitHorizontal } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import MoodCalendar from "./MoodCalendar";
import { apiUrl, authUserPayload } from "../lib/api";
import DiaryInsights from "../component/DiaryInsights";
import { dateInputIndia, formatIndiaDate, publicUserLabel } from "../lib/format";
import { splitDiaryPages } from "../lib/writingCustomize";

const MOOD_CONFIG = {
  angry: "Angry",
  confused: "Confused",
  anxiety: "Anxiety",
  sad: "Sad",
  stress: "Stress",
  gratitude: "Gratitude",
};

export default function Notes({ archived = false }) {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [archiveMessage, setArchiveMessage] = useState(null);
  const [showWelcome, setShowWelcome] = useState(() => sessionStorage.getItem("silentlines_notes_welcome_seen") !== "1");
  const retryTimer = useRef(null);

  const queryParams = new URLSearchParams(location.search);
  const filterDate = queryParams.get("date");

  const fetchEntries = async () => {
    if (!isAuthenticated || !user?.email) {
      console.warn("Fetch entries skipped: not authenticated or no email");
      return;
    }
    try {
      // console.log("Fetching entries for email:", user.email);
      const res = await fetch(apiUrl("/get_entries.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...authUserPayload(user), archived }),
      });
      const data = await readJson(res);
      // console.log("Fetch entries response:", data);
      if (data.status === "success") {
        // console.log("Setting entries:", data.entries?.length || 0, "entries");
        setEntries(data.entries || []);
      } else {
        console.error("Fetch failed with status:", data.status, "message:", data.message);
      }
    } catch (err) {
      console.error("Diary fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading) fetchEntries();

    const sync = () => {
      // console.log("Diary event triggered, refetching entries");
      fetchEntries();
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(fetchEntries, 500);
    };

    window.addEventListener("diary-added", sync);
    window.addEventListener("diary-updated", sync);
    window.addEventListener("diary-archived", sync);
    // console.log("Event listeners registered for diary-added and diary-updated");
    
    return () => {
      window.removeEventListener("diary-added", sync);
      window.removeEventListener("diary-updated", sync);
      window.removeEventListener("diary-archived", sync);
      clearTimeout(retryTimer.current);
    };
  }, [isLoading, isAuthenticated, user?.email, archived]);

  useEffect(() => {
    if (filterDate) setView("list");
  }, [filterDate]);

  useEffect(() => {
    if (!showWelcome) return;
    sessionStorage.setItem("silentlines_notes_welcome_seen", "1");
    const timer = setTimeout(() => setShowWelcome(false), 6500);
    return () => clearTimeout(timer);
  }, [showWelcome]);

  const filtered = entries.filter((entry) => {
    const text = String(entry.entry_text || "").toLowerCase();
    const title = String(entry.diary_title || "").toLowerCase();
    const matchText = text.includes(query.toLowerCase()) || title.includes(query.toLowerCase());
    const entryDate = entry.diary_date || dateInputIndia(entry.created_at);
    const matchDate = filterDate ? entryDate === filterDate : true;
    return matchText && matchDate;
  });

  const totalPages = filtered.length;

  const toggleArchive = async (entryId, nextArchived) => {
    setArchiveMessage(null);
    try {
      const res = await fetch(apiUrl("/archive_entry.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...authUserPayload(user), entry_id: entryId, archive: nextArchived }),
      });
      const data = await readJson(res);
      if (data.status !== "success") throw new Error(data.message || "Archive update failed");
      setEntries((current) => current.filter((entry) => Number(entry.id) !== Number(entryId)));
      setArchiveMessage({
        type: "success",
        text: nextArchived ? "Entry moved to archive." : "Entry restored to notes.",
      });
      window.dispatchEvent(new Event("diary-archived"));
    } catch (err) {
      setArchiveMessage({
        type: "error",
        text: err.message || "Could not update archive.",
      });
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] px-3 py-5 sm:px-4 sm:py-7">
      {showWelcome && (
        <div className="fixed inset-x-3 top-24 z-[70] mx-auto max-w-xl diary-enter rounded-lg border border-orange-200 bg-white p-4 shadow-2xl sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-orange-100 p-2 text-orange-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-orange-600">Welcome back</p>
              <h2 className="mt-1 text-xl font-black text-stone-950">A tiny check-in keeps the habit alive.</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-stone-600">
                Notice the mood, write one honest line, or open an old note and continue the story.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => navigate("/moodselect")} className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-xs font-black text-white">
                  <PenLine className="h-4 w-4" />
                  Start writing
                </button>
                <button onClick={() => navigate("/daily-workspace")} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-black text-stone-700">
                  Daily workspace
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <button onClick={() => setShowWelcome(false)} className="rounded-md px-2 py-1 text-xs font-black text-stone-400 hover:bg-stone-100">
              Skip
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl">
      {archiveMessage && (
        <div className={`fixed inset-x-3 top-24 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-lg border p-4 text-sm font-black shadow-2xl ${
          archiveMessage.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          {archiveMessage.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="flex-1">{archiveMessage.text}</span>
          <button onClick={() => setArchiveMessage(null)} className="rounded-md px-2 py-1 text-xs uppercase">Close</button>
        </div>
      )}
      <div className="mb-6 diary-enter rounded-lg border border-orange-100 bg-white/85 p-4 shadow-sm sm:mb-8 sm:flex sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-orange-100 p-2">
            <BookOpen className="shrink-0 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 sm:text-3xl">{archived ? "Archive" : "My Diary"}</h1>
            <p className="mt-1 text-sm font-semibold text-stone-500">
              {filtered.length} {archived ? "archived" : "saved"} {filtered.length === 1 ? "entry" : "entries"} ready for review
            </p>
          </div>
        </div>

        <div className={`mt-4 grid gap-2 rounded-lg border border-stone-200 bg-stone-100 p-3 sm:mt-0 sm:grid ${archived ? "grid-cols-2" : "grid-cols-[1.75fr_1fr_1fr]"}`}>
          <button
            onClick={() => {
              setView("list");
              navigate(archived ? "/archive" : "/notes");
            }}
            className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ${
              view === "list" ? "bg-white text-orange-600 shadow" : "text-stone-500"
            }`}
          >
            <List className="h-4 w-4" /> List
          </button>
          {!archived && <button
            onClick={() => setView("calendar")}
            className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ${
              view === "calendar" ? "bg-white text-orange-600 shadow" : "text-stone-500"
            }`}
          >
            <CalendarIcon className="h-4 w-4" /> Calendar
          </button>}
          <button
            onClick={() => navigate(archived ? "/notes" : "/archive")}
            className="flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-stone-500 hover:text-orange-600"
          >
            {archived ? <BookOpen className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {archived ? "Notes" : "Archive"}
          </button>
        </div>
      </div>

      {view === "calendar" && <MoodCalendar />}

      {view === "list" && (
        <div className="diary-print-area">
          {!filterDate && <DiaryInsights email={user?.email} entries={entries} />}

          {!filterDate && (
            <div className="relative mb-6 diary-enter sm:mb-8">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-stone-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your memories..."
                className="w-full rounded-lg border border-stone-200 bg-white py-3 pl-12 pr-4 font-semibold outline-none transition focus:ring-4 focus:ring-orange-200"
              />
            </div>
          )}


          {filtered.length === 0 ? (
            <div className="diary-enter rounded-lg border border-dashed border-stone-300 bg-white py-24 text-center">
              <p className="text-stone-400 italic">{archived ? "No archived entries yet." : "Your diary is waiting for words..."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((entry, index) => {
                const otherCollaborators = entry.collaborators || [];
                const isSharedEntry = !entry.owner_is_current_user || otherCollaborators.length > 0;

                return (
                  <div
                    key={entry.id}
                    onClick={() => navigate(`/edit/${entry.id}`, { state: { entry } })}
                    className="diary-card-enter diary-retention-card relative flex min-h-[250px] cursor-pointer flex-col rounded-lg border border-orange-100 border-l-4 border-l-orange-300 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl"
                    style={{ animationDelay: `${Math.min(index, 14) * 55}ms` }}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500">
                        Page {index + 1}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-widest text-stone-400">
                        {formatIndiaDate(entry.diary_date || entry.created_at, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500">
                        {splitDiaryPages(entry.entry_text || "").length} pages
                      </span>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black uppercase text-stone-500">
                        {MOOD_CONFIG[entry.emotion] || "Note"}
                      </span>
                    </div>

                    <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      <GitCommitHorizontal className="h-3.5 w-3.5" />
                      {Number(entry.commit_count || 0)} commits
                    </div>

                    <h2 className="mb-2 line-clamp-2 break-words text-lg font-black leading-6 text-stone-950">
                      {entry.diary_title || "Untitled memory"}
                    </h2>
                    <p className="mb-4 line-clamp-5 flex-1 break-words font-serif text-base leading-7 text-stone-700">
                      {entry.entry_text}
                    </p>

                    {(entry.asset || entry.trade_type) && (
                      <div className="mb-4 grid gap-2 rounded-lg bg-stone-50 p-3 text-xs font-bold uppercase tracking-wider text-stone-600">
                        <span>{entry.trade_type || "Trade"}</span>
                        <span>{entry.asset || "Asset"}</span>
                        <span>Entry: {entry.entry_price || "-"}</span>
                        <span>Exit: {entry.exit_price || "-"}</span>
                      </div>
                    )}

                    <div className="mt-auto flex min-h-12 items-center justify-between gap-3 border-t border-stone-100 pt-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleArchive(entry.id, !archived);
                        }}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 text-xs font-black uppercase tracking-widest text-stone-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                        aria-label={archived ? "Restore diary entry" : "Archive diary entry"}
                      >
                        {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        {archived ? "Restore" : "Archive"}
                      </button>

                      {isSharedEntry ? (
                        <div className="flex min-w-0 items-center justify-end">
                          <div className="mr-2 truncate text-[10px] font-bold uppercase tracking-wider text-stone-400">
                            {!entry.owner_is_current_user ? publicUserLabel({ full_name: entry.owner_label }, "Shared note") : "Collaborators"}
                          </div>
                          <div className="flex shrink-0 -space-x-3">
                            {otherCollaborators.map((collab, index) => (
                              <div key={index} className="relative">
                                {collab.picture ? (
                                  <img
                                    src={collab.picture}
                                    alt={collab.username || "Collaborator"}
                                    className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm"
                                    title={collab.username || "Collaborator"}
                                  />
                                ) : (
                                  <div
                                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-orange-200 text-xs font-bold text-orange-700 shadow-sm"
                                    title={collab.username || "Collaborator"}
                                  >
                                    {(collab.username || "C").charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ))}
                            {!entry.owner_is_current_user && (
                              <div className="relative">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-stone-800 text-xs font-bold text-white shadow-sm" title="Owner">
                                  {publicUserLabel({ full_name: entry.owner_label }, "S").replace(/^@/, "").charAt(0).toUpperCase()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="min-w-0 flex-1" aria-hidden="true" />
                      )}
                      </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
