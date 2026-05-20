import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { ArrowRight, Brain, CheckCircle2, Coffee, Loader2, PenLine, Save, Sparkles, SunMedium } from "lucide-react";
import { apiUrl, postJson } from "../lib/api";
import { dateInputIndia, formatIndiaDate, todayIndiaInput } from "../lib/format";

const moods = ["calm", "focused", "tired", "heavy", "curious", "grateful"];
const focusAreas = ["personal", "programming", "study", "business", "trading", "relationships"];
const intentionSuggestions = {
  personal: "Example: write one honest paragraph about today",
  programming: "Example: fix one bug or write 10 clean lines of code",
  study: "Example: revise one topic and write three key points",
  business: "Example: review one offer, cost, or customer idea",
  trading: "Example: review one setup and write the risk before action",
  relationships: "Example: message one person with patience and clarity",
};
const moodAdvice = {
  calm: "Use this calm to do the thing you usually postpone.",
  focused: "Protect this focus. Pick one task and close the extra tabs.",
  tired: "Be honest: reduce the task size. A small finished step beats a dramatic plan.",
  heavy: "Do not force brightness. Name the weight, then choose one gentle action.",
  curious: "Follow the question, but write down what you learn so it becomes useful later.",
  grateful: "Turn gratitude into attention. Notice what is working and repeat one part of it.",
};

export default function DailyWorkspace() {
  const { user, isAuthenticated } = useAuth0();
  const [mood, setMood] = useState("focused");
  const [energy, setEnergy] = useState(3);
  const [focusArea, setFocusArea] = useState("personal");
  const [intention, setIntention] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [reflection, setReflection] = useState("");
  const [provider, setProvider] = useState("");
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const streak = useMemo(() => {
    const dates = new Set(history.map((entry) => entry.entry_date));
    let count = 0;
    const cursor = new Date();
    while (dates.has(dateInputIndia(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [history]);

  const loadHistory = async () => {
    if (!isAuthenticated || !user?.email) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl("/daily_workspace.php")}?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (data.status === "success") {
        setHistory(data.entries || []);
        const today = (data.entries || []).find((entry) => entry.entry_date === todayIndiaInput());
        if (today) {
          setMood(today.mood || "focused");
          setEnergy(Number(today.energy || 3));
          setFocusArea(today.focus_area || "personal");
          setIntention(today.intention || "");
          setQuickNote(today.quick_note || "");
          setReflection(today.ai_reflection || "");
        }
      }
    } catch {
      setMessage("Could not load your daily workspace yet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [isAuthenticated, user?.email]);

  const saveDaily = async () => {
    if (!user?.email) return;
    setSaving(true);
    setMessage("");
    try {
      const data = await postJson("/daily_workspace.php", {
        email: user.email,
        mood,
        energy,
        focus_area: focusArea,
        intention,
        quick_note: quickNote,
      });
      if (data.status !== "success") throw new Error(data.message || "Daily save failed");
      setReflection(data.reflection || "");
      setProvider(data.provider || "");
      setMessage("Daily workspace saved.");
      loadHistory();
    } catch (err) {
      setMessage(err.message || "Could not save daily workspace.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbfaf7] px-4 py-6 text-stone-900">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="diary-enter grid gap-5 rounded-lg border border-rose-100 bg-white p-5 shadow-sm lg:grid-cols-[1fr_330px] lg:p-7">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-700">
              <SunMedium className="h-4 w-4" />
              Common Daily Workspace
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-stone-950 sm:text-5xl">
              One place to return every day.
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-stone-600">
              A simple check-in for diary writers, programmers, students, traders, and anyone trying to stay consistent. Sarvam AI reads your note like a friend and turns it into practical guidance.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge icon={CheckCircle2} label={`${streak} day streak`} />
              <Badge icon={Coffee} label="2 minute ritual" />
              <Badge icon={Brain} label={provider || "AI reflection"} />
            </div>
          </div>
          <div className="diary-floating rounded-lg border border-rose-100 bg-rose-50 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-rose-700">Today cue</p>
            <p className="mt-3 text-2xl font-black leading-tight text-stone-950">
              Pick mood, choose focus, write one line, save.
            </p>
            <button onClick={saveDaily} disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save today's check-in
            </button>
          </div>
        </section>

        {message && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">{message}</div>}

        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="diary-enter rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-stone-950">
              <PenLine className="h-5 w-5 text-rose-700" />
              Today's Check-In
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-stone-500">Mood</p>
                <div className="grid grid-cols-2 gap-2">
                  {moods.map((item) => (
                    <button key={item} onClick={() => setMood(item)} className={`rounded-lg border px-3 py-2 text-sm font-black capitalize transition ${mood === item ? "border-rose-300 bg-rose-50 text-rose-800" : "border-stone-200 bg-stone-50 text-stone-600"}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <label className="text-xs font-black uppercase tracking-widest text-stone-500">
                Energy: {energy}/5
                <input type="range" min="1" max="5" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} className="mt-4 w-full accent-rose-700" />
              </label>
              <label className="text-xs font-black uppercase tracking-widest text-stone-500">
                Focus area
                <select value={focusArea} onChange={(event) => setFocusArea(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-200 bg-white p-3 text-sm font-bold normal-case tracking-normal text-stone-900">
                  {focusAreas.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase tracking-widest text-stone-500">
                Tiny intention
                <input value={intention} onChange={(event) => setIntention(event.target.value)} placeholder={intentionSuggestions[focusArea]} className="mt-2 w-full rounded-lg border border-stone-200 bg-white p-3 text-sm font-semibold normal-case tracking-normal text-stone-900" />
              </label>
            </div>
            <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-rose-700">Honest mood advice</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-stone-950">{moodAdvice[mood]}</p>
            </div>
            <label className="mt-4 block text-xs font-black uppercase tracking-widest text-stone-500">
              Quick note
              <textarea value={quickNote} onChange={(event) => setQuickNote(event.target.value)} rows="7" placeholder="What is one thing your future self should know about today?" className="mt-2 w-full rounded-lg border border-stone-200 bg-white p-3 text-sm font-medium normal-case tracking-normal text-stone-900" />
            </label>
          </div>

          <div className="space-y-5">
            <section className="diary-enter rounded-lg border border-rose-100 bg-white p-5 shadow-sm" style={{ animationDelay: "120ms" }}>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-rose-700" />
                <h2 className="text-lg font-black text-stone-950">AI Daily Reflection</h2>
              </div>
              {reflection ? (
                <p className="whitespace-pre-wrap rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm font-semibold leading-7 text-stone-900">{reflection}</p>
              ) : (
                <p className="rounded-lg bg-stone-50 p-4 text-sm font-semibold leading-7 text-stone-500">
                  Save today's check-in and Sarvam AI will give a mood-based reflection, one realistic recommendation, and honest advice for what to do next.
                </p>
              )}
            </section>

            <section className="diary-enter rounded-lg border border-stone-200 bg-white p-5 shadow-sm" style={{ animationDelay: "180ms" }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black text-stone-950">Recent Returns</h2>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-rose-700" />}
              </div>
              <div className="space-y-2">
                {history.slice(0, 7).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-stone-900">{formatIndiaDate(entry.entry_date)}</p>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-black capitalize text-rose-700">{entry.mood || "check-in"}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">{entry.intention || entry.quick_note || "Daily return saved."}</p>
                  </div>
                ))}
                {!history.length && !loading && <p className="rounded-lg bg-stone-50 p-4 text-sm font-semibold text-stone-500">No daily check-ins yet.</p>}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Badge({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-800">
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}
