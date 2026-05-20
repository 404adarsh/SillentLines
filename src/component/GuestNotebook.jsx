import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Heart, LockKeyhole, PenLine, Save, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { emptyGuestDraft, loadGuestDraft, saveGuestDraft } from "../lib/guestDraft";
import MusicPlayer from "./MusicPlayer";

const MOODS = [
  { id: "gratitude", label: "Soft", accent: "#be123c", wash: "#fff1f2" },
  { id: "confused", label: "Messy", accent: "#7c3aed", wash: "#f5f3ff" },
  { id: "sad", label: "Blue", accent: "#2563eb", wash: "#eff6ff" },
  { id: "stress", label: "Busy", accent: "#ea580c", wash: "#fff7ed" },
];

const GUEST_MUSIC_CONFIG = {
  gratitude: { tracks: [] },
  confused: { tracks: [] },
  sad: { tracks: [] },
  stress: { tracks: [] },
};

export default function GuestNotebook({ compact = false, source = "share" }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => loadGuestDraft() || emptyGuestDraft());
  const [saved, setSaved] = useState(false);
  const mood = useMemo(() => MOODS.find((item) => item.id === draft.mood) || MOODS[0], [draft.mood]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft.content.trim() || draft.title.trim()) {
        saveGuestDraft({ ...draft, source });
        setSaved(true);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, source]);

  const updateDraft = (patch) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const goLogin = () => {
    saveGuestDraft({ ...draft, source });
    navigate("/login");
  };

  return (
    <section className={`${compact ? "" : "min-h-screen"} bg-[#f7f1e6] px-4 pb-32 pt-8 text-stone-950 sm:pb-36`}>
      <MusicPlayer moodId={draft.mood} MOOD_CONFIG={GUEST_MUSIC_CONFIG} />
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-700 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Try SilentLines without login
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">Write your feeling on this little notebook.</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-stone-600">
              This draft stays in this browser. Login only when you want to save it permanently or share it.
            </p>
          </div>
          <button
            onClick={goLogin}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-stone-950 px-5 text-sm font-black text-white shadow-lg"
          >
            Save after login
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-amber-200 bg-white shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-rose-600 shadow-sm">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-stone-400">Guest diary</p>
                <p className="text-sm font-black text-stone-800">{saved ? "Saved in this browser" : "Writing..."}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => updateDraft({ mood: item.id })}
                  className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-widest transition ${
                    draft.mood === item.id ? "border-transparent text-white shadow-sm" : "border-stone-200 bg-white text-stone-500"
                  }`}
                  style={draft.mood === item.id ? { backgroundColor: item.accent } : undefined}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-b border-amber-100 bg-white p-4 sm:grid-cols-[1fr_180px]">
            <label className="text-xs font-black uppercase tracking-widest text-stone-500">
              Title
              <input
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                placeholder="Give this feeling a name"
                className="mt-2 w-full rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-stone-900 outline-none focus:ring-4 focus:ring-rose-100"
              />
            </label>
            <label className="text-xs font-black uppercase tracking-widest text-stone-500">
              Date
              <input
                type="date"
                value={draft.entryDate}
                onChange={(event) => updateDraft({ entryDate: event.target.value })}
                className="mt-2 w-full rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-stone-900 outline-none focus:ring-4 focus:ring-rose-100"
              />
            </label>
          </div>

          <div
            className="relative min-h-[430px]"
            style={{
              backgroundColor: mood.wash,
              backgroundImage: "linear-gradient(rgba(180, 83, 9, 0.18) 1px, transparent 1px)",
              backgroundSize: "100% 2.65rem",
            }}
          >
            <div className="absolute bottom-0 left-10 top-0 w-px bg-rose-200" />
            <textarea
              autoFocus
              value={draft.content}
              onChange={(event) => updateDraft({ content: event.target.value })}
              placeholder="Dear diary, today I feel..."
              className="absolute inset-0 h-full min-h-full w-full resize-none border-0 bg-transparent p-6 pl-16 text-2xl leading-[2.65rem] text-stone-800 outline-none focus:ring-0 sm:p-10 sm:pl-20 sm:text-3xl"
              style={{ fontFamily: "'Caveat', cursive" }}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-amber-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-500">
              <LockKeyhole className="h-4 w-4" />
              Local draft only
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  saveGuestDraft({ ...draft, source });
                  setSaved(true);
                }}
                disabled={!draft.content.trim() && !draft.title.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-sm font-black text-stone-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Keep draft
              </button>
              <button
                onClick={goLogin}
                disabled={!draft.content.trim() && !draft.title.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black text-white shadow-lg disabled:opacity-50"
                style={{ backgroundColor: mood.accent }}
              >
                <Heart className="h-4 w-4" fill="currentColor" />
                Login to save
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-stone-400">
          Already have an account? <Link to="/login" className="text-stone-900 underline underline-offset-4">Login and save this draft</Link>
        </p>
      </div>
    </section>
  );
}
