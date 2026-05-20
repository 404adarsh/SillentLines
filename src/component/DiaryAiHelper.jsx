import { Bot, HeartHandshake, Loader2, MessageCircle, PlusCircle, Save, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { postJson } from "../lib/api";
import { formatIndiaDate } from "../lib/format";

const SAVED_AI_KEY = "silentlines_saved_ai_suggestions_v1";
const CHAT_KEY = "silentlines_entry_ai_chat_v1";

const quickActions = [
  "Explain what I wrote",
  "What should I do next?",
  "Give me smart suggestions",
  "Rewrite this better",
  "Make this clearer",
  "Find the real feeling",
];

export default function DiaryAiHelper({ email, entryId, entryTitle, content, mood, onInsert }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [inserted, setInserted] = useState(false);
  const [saved, setSaved] = useState(() => loadSaved(email));
  const [chat, setChat] = useState(() => loadChat(email, entryId));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Ask anything about this diary entry.");
  const [aiStatus, setAiStatus] = useState({ is_blocked: false, ai_enabled: true, access_count: 0 });

  useEffect(() => {
    setSaved(loadSaved(email));
    setChat(loadChat(email, entryId));
  }, [email, entryId]);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    postJson("/diary_ai.php", { email, action: "status" })
      .then((data) => {
        if (!cancelled && data.status === "success") {
          setAiStatus({
            is_blocked: Boolean(data.is_blocked),
            ai_enabled: data.ai_enabled !== 0,
            access_count: Number(data.access_count || 0),
          });
          setMessage(data.is_blocked ? "AI buddy is blocked for this account." : "Ask anything about this diary entry.");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [email]);

  const visibleSaved = useMemo(() => saved.slice(0, 5), [saved]);

  const toggleAi = async () => {
    if (!email) return;
    const action = aiStatus.is_blocked ? "unblock" : "block";
    try {
      const data = await postJson("/diary_ai.php", { email, action, entry_id: entryId, instruction: "ui toggle" });
      if (data.status !== "success") throw new Error(data.message || "Could not update AI state.");
      setAiStatus((current) => ({ ...current, is_blocked: Boolean(data.is_blocked) }));
      setMessage(data.message || (data.is_blocked ? "AI buddy is blocked." : "AI buddy is unblocked."));
    } catch (err) {
      setMessage(err.message || "Could not update AI state.");
    }
  };

  const askAi = async (prompt = question) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || loading) return;
    if (!aiStatus.ai_enabled) {
      setMessage("AI buddy is turned off in your settings.");
      return;
    }
    if (aiStatus.is_blocked) {
      setMessage("AI buddy is blocked for this account. Unblock it to continue.");
      return;
    }
    if (!content.trim()) {
      setMessage("Write something in the diary first, then I can understand it.");
      return;
    }

    const userTurn = { role: "user", text: cleanPrompt, createdAt: new Date().toISOString() };
    const pendingChat = [...chat, userTurn].slice(-30);
    setChat(pendingChat);
    saveChat(email, entryId, pendingChat);
    setQuestion("");
    setLoading(true);
    setInserted(false);
    setMessage("");

    try {
      const data = await postJson("/diary_ai.php", {
        email,
        mood,
        mode: "entry_chat",
        instruction: cleanPrompt,
        existing_text: content,
        entry_id: entryId,
        entry_title: entryTitle,
      });
      if (data.status !== "success") throw new Error(data.message || "AI helper failed.");
      addAssistantReply(data.suggestion || "", pendingChat, data.provider ? `Ready from ${data.provider}.` : "Ready.");
    } catch {
      addAssistantReply(localEntryChat({ instruction: cleanPrompt, content, mood }), pendingChat, "Ready locally.");
    } finally {
      setLoading(false);
    }
  };

  const addAssistantReply = (reply, previousChat, readyMessage) => {
    const assistantTurn = { role: "assistant", text: reply, createdAt: new Date().toISOString() };
    const next = [...previousChat, assistantTurn].slice(-30);
    setChat(next);
    saveChat(email, entryId, next);
    setLastReply(reply);
    setMessage(readyMessage);
  };

  const insertReply = () => {
    if (!lastReply.trim() || inserted) return;
    onInsert(`${content.trim() ? "\n\n" : ""}${lastReply.trim()}`);
    setInserted(true);
    setMessage("Added to your diary.");
  };

  const saveSuggestion = (text = lastReply) => {
    if (!text.trim()) return;
    const next = [
      {
        id: `${Date.now()}`,
        email: email || "local",
        entryId: entryId || "",
        entryTitle: entryTitle || "Diary entry",
        mood: mood || "",
        mode: "entry_chat",
        text: text.trim(),
        instruction: question.trim(),
        createdAt: new Date().toISOString(),
      },
      ...saved,
    ].slice(0, 60);
    setSaved(next);
    saveSaved(email, next);
    window.dispatchEvent(new Event("silentlines-ai-suggestions-updated"));
    setMessage("Saved. You can see it again in diary review.");
  };

  const clearChat = () => {
    setChat([]);
    saveChat(email, entryId, []);
    setLastReply("");
    setMessage("Chat cleared for this entry.");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!aiStatus.ai_enabled}
        className="fixed bottom-24 right-4 z-[2500] flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-3 text-gray-950 shadow-2xl ring-4 ring-white/30 transition hover:scale-105 sm:bottom-28 sm:right-6 sm:h-16 sm:w-16 sm:px-0"
        aria-label="Open AI diary chat"
        title="Open AI diary chat"
      >
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-rose-500 to-amber-400 opacity-90" />
        <Bot className="relative h-6 w-6 text-white sm:h-8 sm:w-8" />
        <span className="relative text-xs font-black uppercase text-white sm:hidden">AI Help</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[3000] flex items-stretch justify-center bg-black/55 p-0 backdrop-blur-md sm:items-center sm:p-3">
          <div className="flex h-dvh w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-lg">
            <div className="bg-slate-950 p-4 text-white sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest text-white/70">SilentLines AI</p>
                    <h2 className="text-xl font-black leading-tight sm:text-2xl">Ask about this diary</h2>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Close AI chat" title="Close AI chat">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-3 sm:p-4 lg:grid-cols-[1fr_260px]">
              <div className="flex min-h-[70dvh] flex-col rounded-lg border border-slate-200 bg-slate-50 sm:min-h-[420px]">
                <div className="border-b border-slate-200 p-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Current entry context</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-700">{entryTitle || "Untitled diary"} - {content.trim() || "No diary text yet."}</p>
                </div>

                <div className="flex-1 space-y-3 overflow-auto p-3">
                  {chat.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold leading-6 text-slate-500">
                      Ask me to explain what is written, suggest what to do, rewrite it, improve it, or talk about any part of this entry.
                    </div>
                  ) : (
                    chat.map((item, index) => (
                      <div key={`${item.createdAt}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[88%] whitespace-pre-wrap rounded-lg p-3 text-sm font-semibold leading-6 ${item.role === "user" ? "bg-slate-950 text-white" : "bg-white text-slate-800 shadow-sm"}`}>
                          {item.text}
                          {item.role === "assistant" && (
                            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                              <button onClick={() => setLastReply(item.text) || saveSuggestion(item.text)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-black text-slate-600">
                                <Save className="h-3.5 w-3.5" />
                                Save
                              </button>
                              <button onClick={() => setLastReply(item.text)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-black text-slate-600">
                                <PlusCircle className="h-3.5 w-3.5" />
                                Use
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm font-bold text-slate-500 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reading your diary...
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white p-3">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {quickActions.map((item) => (
                      <button key={item} onClick={() => askAi(item)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-200">
                        {item}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="ai-diary-question" className="sr-only">Ask a question about this diary entry</label>
                  <div className="flex gap-2">
                    <textarea
                      id="ai-diary-question"
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          askAi();
                        }
                      }}
                      rows="4"
                      placeholder="Ask anything: explain this diary, rewrite it, suggest what I should do, make it smarter..."
                      className="min-h-28 flex-1 resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    />
                    <button onClick={() => askAi()} disabled={loading || !question.trim()} className="flex min-h-28 min-w-20 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black uppercase text-white disabled:opacity-50 sm:min-w-16" aria-label="Send message">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      <span className="sm:hidden">Send</span>
                    </button>
                  </div>
                </div>
              </div>

              <aside className="grid content-start gap-3">
                {message && <p className="rounded-lg bg-slate-100 p-3 text-xs font-black uppercase tracking-widest text-slate-500">{message}</p>}
                <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-slate-500">
                  Accesses this month: {aiStatus.access_count}
                </p>
                <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
                  <button onClick={toggleAi} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                    {aiStatus.is_blocked ? <Sparkles className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {aiStatus.is_blocked ? "Unblock AI" : "Block AI"}
                  </button>
                  <button onClick={insertReply} disabled={!lastReply.trim() || inserted} className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-500">
                    <PlusCircle className="h-4 w-4" />
                    {inserted ? "Added" : "Add Last Reply"}
                  </button>
                  <button onClick={() => saveSuggestion()} disabled={!lastReply.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-4 py-3 text-sm font-black text-purple-700 disabled:opacity-50">
                    <Save className="h-4 w-4" />
                    Save Last Reply
                  </button>
                  <button onClick={clearChat} className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-black text-slate-600">
                    Clear Chat
                  </button>
                </div>

                {visibleSaved.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 text-slate-700">
                      <HeartHandshake className="h-4 w-4" />
                      <p className="text-xs font-black uppercase tracking-widest">Saved Replies</p>
                    </div>
                    <div className="grid gap-2">
                      {visibleSaved.map((item) => (
                        <button key={item.id} onClick={() => setLastReply(item.text)} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-left transition hover:bg-slate-100">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {formatIndiaDate(item.createdAt)}
                          </div>
                          <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-slate-700">{item.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function localEntryChat({ instruction, content, mood }) {
  const ask = instruction.toLowerCase();
  const text = content.trim();
  if (/\b(explain|what is written|inside|meaning|understand)\b/.test(ask)) {
    return `Here is what this diary is saying:\n\n${summarizeText(text)}\n\nThe main mood feels like ${mood || "mixed"}. The important part is not only the words, but what they point to: something in your day needs attention, clarity, or a next step.`;
  }
  if (/\b(rewrite|modify|change|better|clearer|improve)\b/.test(ask)) {
    return `A clearer version:\n\n${text || "I am trying to understand what I feel and what I should do next."}\n\nI can make it more emotional, smarter, shorter, or more direct if you ask.`;
  }
  if (/\b(suggest|what should|next|smart|do)\b/.test(ask)) {
    if (mentionsCode(text)) {
      return `Smart next steps:\n\n1. Write the exact error or broken behavior.\n2. Check console, network, and backend response.\n3. Reproduce the bug with the smallest example.\n4. Add one log before and after the suspicious line.\n5. Change one thing at a time.\n\nYou do not need to panic-code, boss. Debug like a detective: one clue, one test, one fix.`;
    }
    return `What you can do next:\n\n1. Name the real issue in one sentence.\n2. Pick one action small enough to do today.\n3. Write what support, courage, or clarity you need.\n4. Come back and update the diary after doing it.\n\nSmart move: do not solve your whole life in one tab. One clean step first.`;
  }
  return `I read this entry as: ${summarizeText(text)}\n\nMy suggestion: ask one specific question about it, or tell me whether you want comfort, a rewrite, practical steps, or a sharper explanation.`;
}

function summarizeText(text) {
  if (!text) return "There is not enough written yet to explain deeply.";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 260 ? `${clean.slice(0, 260)}...` : clean;
}

function mentionsCode(text) {
  return /\b(code|coding|bug|error|console|api|react|php|server|database|not working|isn't working|isnt working)\b/i.test(text);
}

function storageKey(email) {
  return `${SAVED_AI_KEY}:${email || "local"}`;
}

function chatKey(email, entryId) {
  return `${CHAT_KEY}:${email || "local"}:${entryId || "new"}`;
}

export function loadSaved(email) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(email)) || "[]");
  } catch {
    return [];
  }
}

function saveSaved(email, items) {
  localStorage.setItem(storageKey(email), JSON.stringify(items));
}

function loadChat(email, entryId) {
  try {
    return JSON.parse(localStorage.getItem(chatKey(email, entryId)) || "[]");
  } catch {
    return [];
  }
}

function saveChat(email, entryId, items) {
  localStorage.setItem(chatKey(email, entryId), JSON.stringify(items));
}
