import { BarChart3, CalendarDays, HeartHandshake, Loader2, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { postJson } from "../lib/api";
import { formatIndiaDate, formatIndiaDateTime } from "../lib/format";
import { loadSaved } from "./DiaryAiHelper";

const INSIGHT_KEY = "silentlines_diary_period_insights_v1";

export default function DiaryInsights({ email, entries }) {
  const [period, setPeriod] = useState("weekly");
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(() => loadInsights(email));
  const [savedSuggestions, setSavedSuggestions] = useState(() => loadSaved(email));
  const [message, setMessage] = useState("Analyze your week or month when you want a bigger-picture check-in.");

  useEffect(() => {
    const sync = () => setSavedSuggestions(loadSaved(email));
    window.addEventListener("silentlines-ai-suggestions-updated", sync);
    return () => window.removeEventListener("silentlines-ai-suggestions-updated", sync);
  }, [email]);

  const selectedEntries = useMemo(() => filterEntries(entries, period), [entries, period]);
  const currentInsight = insights.find((item) => item.period === period);

  const analyze = async () => {
    if (selectedEntries.length === 0) {
      setMessage("No entries in this period yet. Write a little first, then I can read the pattern.");
      return;
    }
    setLoading(true);
    setMessage("");
    const existingText = selectedEntries
      .slice(0, 18)
      .map((entry) => {
        const date = entry.diary_date || entry.created_at || "";
        const title = entry.diary_title || "Untitled";
        return `[${date}] ${title}\nMood: ${entry.emotion || "unknown"}\n${entry.entry_text || ""}`;
      })
      .join("\n\n---\n\n");

    try {
      const data = await postJson("/diary_ai.php", {
        email,
        mode: `${period}_summary`,
        mood: "period review",
        existing_text: existingText,
        instruction: "Base the review only on the diary entries. Read every entry carefully and talk directly to the user like a close friend. First explain what you understood from their writing. Mention the actual topics, worries, repeated thoughts, moods, and practical problems they wrote about. Console them where they sound hurt or tired. Give detailed guidance, not generic motivation. Include what they can do, what they must do, what they should stop doing, and one clear plan for today. If they are avoiding the obvious next step, gently scold them with care. If they wrote about code, bugs, study, exams, work, business, or relationships, give specific practical advice for that topic. Do not repeat these instructions.",
      });
      if (data.status !== "success") throw new Error(data.message || "Review failed");
      saveInsight(data.suggestion || localPeriodFallback(period, selectedEntries));
      setMessage(data.provider ? `Review ready from ${data.provider}.` : "Review ready.");
    } catch {
      saveInsight(localPeriodFallback(period, selectedEntries));
      setMessage("Review ready locally.");
    } finally {
      setLoading(false);
    }
  };

  const saveInsight = (text) => {
    const next = [
      {
        id: `${period}-${Date.now()}`,
        period,
        text,
        count: selectedEntries.length,
        createdAt: new Date().toISOString(),
      },
      ...insights.filter((item) => item.period !== period),
    ].slice(0, 20);
    setInsights(next);
    localStorage.setItem(storageKey(email), JSON.stringify(next));
  };

  return (
    <section className="mb-6 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-800">
            <BarChart3 className="h-4 w-4" />
            Diary Review
          </div>
          <h2 className="mt-3 text-2xl font-black text-stone-950">Weekly and monthly AI summary</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-stone-600">
            Pull the pattern from your entries, get comfort, suggestions, and saved notes you can come back to.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-stone-200 bg-stone-100 p-1">
          {["weekly", "monthly"].map((item) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`rounded-md px-4 py-2 text-sm font-black capitalize ${period === item ? "bg-white text-emerald-700 shadow" : "text-stone-500"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-stone-100 bg-stone-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-stone-600">
              <CalendarDays className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-widest">{selectedEntries.length} entries in this {period === "weekly" ? "week" : "month"}</p>
            </div>
            <button
              onClick={analyze}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Analyze
            </button>
          </div>

          {message && <p className="mt-3 text-xs font-bold uppercase tracking-widest text-stone-400">{message}</p>}
          {currentInsight ? (
            <div className="mt-4 whitespace-pre-wrap rounded-lg border border-emerald-100 bg-white p-4 text-sm font-semibold leading-7 text-stone-700">
              {currentInsight.text}
              <div className="mt-4 flex items-center gap-2 border-t border-stone-100 pt-3 text-[10px] font-black uppercase tracking-widest text-stone-400">
                <Save className="h-3.5 w-3.5" />
                Saved {formatIndiaDateTime(currentInsight.createdAt)}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-stone-200 bg-white p-6 text-center text-sm font-semibold text-stone-400">
              Your {period} review will appear here.
            </div>
          )}
        </div>

        <div className="rounded-lg border border-stone-100 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-stone-700">
            <HeartHandshake className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-widest">Saved AI Suggestions</p>
          </div>
          {savedSuggestions.length === 0 ? (
            <p className="rounded-lg bg-stone-50 p-4 text-sm font-semibold leading-6 text-stone-500">
              Saved companion replies and suggestions will show here.
            </p>
          ) : (
            <div className="grid max-h-72 gap-2 overflow-auto pr-1">
              {savedSuggestions.slice(0, 8).map((item) => (
                <article key={item.id} className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                    {formatIndiaDate(item.createdAt)} - {item.entryTitle || item.mode}
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-stone-700">{item.text}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function filterEntries(entries, period) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "weekly") {
    start.setDate(now.getDate() - 6);
  } else {
    start.setMonth(now.getMonth() - 1);
  }
  return entries.filter((entry) => new Date(entry.diary_date || entry.created_at || Date.now()) >= start);
}

function loadInsights(email) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(email)) || "[]");
  } catch {
    return [];
  }
}

function storageKey(email) {
  return `${INSIGHT_KEY}:${email || "local"}`;
}

function localPeriodFallback(period, entries) {
  const moods = entries.reduce((acc, entry) => {
    const mood = entry.emotion || "unknown";
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {});
  const topMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";
  const allText = entries.map((entry) => `${entry.diary_title || ""} ${entry.entry_text || ""}`).join("\n").toLowerCase();
  const periodLabel = period === "weekly" ? "week" : "month";

  if (mentionsCode(allText)) {
    return `I read your ${periodLabel} and I can see one clear thing: your mind is not only emotional, it is busy fighting practical code problems.\n\nWhat I understood:\nYou are trying to make something work, but the problem feels messy enough that frustration is becoming part of the work. That is dangerous because once a bug starts feeling personal, you stop debugging and start wrestling with the whole project.\n\nListen, friend:\nYou are allowed to be irritated. But I am going to gently scold you: do not keep changing random code just because you are anxious. That is how one bug becomes five bugs. Slow down and make the problem smaller.\n\nWhat you can do:\n1. Write the exact broken behavior in one sentence.\n2. Open the console and network tab before editing anything.\n3. Reproduce the issue with the smallest possible click or input.\n4. Add one log before and after the suspicious line.\n5. Compare with the last version that worked.\n6. Change one thing, test, then continue.\n\nWhat you must do:\nKeep a tiny debugging note. Write what you tried, what changed, and what failed. Future-you deserves evidence, not confusion.\n\nPlan for today:\nPick one bug only. Give it 25 focused minutes. Your goal is not to fix the universe; your goal is to understand the next clue.`;
  }

  if (mentionsStudyOrWork(allText)) {
    return `I read your ${periodLabel} and it sounds like pressure is sitting on top of your plans.\n\nWhat I understood:\nYou want progress, but the task feels heavy, so your brain keeps searching for escape routes. That does not mean you are lazy. It means the next step is not clear enough yet.\n\nFriend advice:\nBe kind to yourself, yes. But also stop waiting for a magical perfect mood. I am lovingly scolding you here: if you already know the next small task, start it before your brain opens a meeting about it.\n\nWhat you can do:\n1. Choose one subject, task, or responsibility.\n2. Break it into a 20-minute start.\n3. Remove one distraction before beginning.\n4. Write three points you understood.\n5. Write the one part that confused you.\n\nWhat you must do:\nProtect attention. No fake multitasking. No pretending that planning for one hour is the same as working for 20 minutes.\n\nPlan for today:\nOne focused block, one visible result, one short diary update. That is enough to restart trust with yourself.`;
  }

  return `I read your ${periodLabel}. You wrote ${entries.length} diary ${entries.length === 1 ? "entry" : "entries"}, and the strongest visible mood is ${topMood}.\n\nWhat I understood:\nYour writing is pointing to something that keeps returning. It may be a task, fear, person, regret, or unfinished decision. The feeling is not random; it is a signal asking for attention.\n\nLet me console you first:\nYou do not have to solve everything today. You only need to stop abandoning yourself when the feeling becomes inconvenient. Your diary is proof that some part of you still wants clarity.\n\nHonest advice:\nI will gently scold you if needed: do not keep saying “I do not know” when you actually know the first tiny step and are scared to start. Start scared. Start messy. But start.\n\nWhat you can do:\n1. Name the repeated issue in one sentence.\n2. Separate what you control from what you cannot control.\n3. Choose one action small enough to do today.\n4. Ask for help if the issue is too heavy to carry alone.\n5. Return tonight and write what changed.\n\nWhat you must do:\nStop treating your emotions like enemies. Listen to them, then choose one grounded action.`;
}

function mentionsCode(text) {
  return /\b(code|coding|bug|error|console|project|function|react|php|api|database|server|frontend|backend|compile|build|not working|isn't working|isnt working)\b/i.test(text);
}

function mentionsStudyOrWork(text) {
  return /\b(study|exam|work|task|job|assignment|deadline|learn|practice|meeting|office)\b/i.test(text);
}
