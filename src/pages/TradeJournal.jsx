import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { BarChart3, BookOpenCheck, BriefcaseBusiness, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { Line } from "react-chartjs-2";
import { apiUrl, authUserPayload, postJson } from "../lib/api";
import { formatIndiaDate } from "../lib/format";

const journalTemplates = {
  beginner: {
    label: "Beginner Worksheet",
    risk: "Risk only what I can explain clearly.",
    thesis: "I am learning to write my reason, target, and invalidation before any trade.",
    lesson: "What did I understand well, and what still confused me?",
  },
  scalping: {
    label: "Scalping Pad",
    risk: "Exit fast if momentum fades or spread becomes ugly.",
    thesis: "This is a short-holding trade based on momentum, liquidity, and speed.",
    lesson: "Did I respect timing, execution, and stop discipline?",
  },
  swing: {
    label: "Swing Setup",
    risk: "Invalid below the higher-timeframe support I planned.",
    thesis: "This setup has room for a multi-day move because structure and trend support it.",
    lesson: "Did my holding period match the timeframe I claimed?",
  },
  investor: {
    label: "Investor Note",
    risk: "Size small enough to tolerate volatility without panic decisions.",
    thesis: "This note tracks a conviction-based allocation, not a fast trade.",
    lesson: "Was I investing with patience, or secretly trading emotionally?",
  },
  commerce: {
    label: "Commerce Decision",
    risk: "Watch unit economics, cash flow, and weak demand assumptions.",
    thesis: "This journal tracks capital, return logic, break-even thinking, and business rationale.",
    lesson: "Did I reason clearly about cost, margin, and cash cycle?",
  },
};

const emptyForm = {
  asset: "BTC",
  trade_type: "buy",
  entry_price: "",
  exit_price: "",
  capital: "",
  risk: "",
  thesis: "",
  lesson: "",
  emotion: "discipline",
};

export default function TradeJournal() {
  const { user, isAuthenticated } = useAuth0();
  const [form, setForm] = useState(emptyForm);
  const [format, setFormat] = useState("beginner");
  const [saving, setSaving] = useState(false);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [demo, setDemo] = useState(null);
  const [message, setMessage] = useState("");
  const [savedTrades, setSavedTrades] = useState([]);

  const chartData = useMemo(
    () => ({
      labels: (demo?.prices || []).map((point) => point.date),
      datasets: [
        {
          label: `${form.asset} price`,
          data: (demo?.prices || []).map((point) => point.price),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.12)",
          tension: 0.28,
          fill: true,
        },
      ],
    }),
    [demo, form.asset]
  );

  useEffect(() => {
    const template = journalTemplates[format];
    setForm((current) => ({
      ...current,
      risk: current.risk && current.risk !== journalTemplates.beginner.risk ? current.risk : template.risk,
      thesis: current.thesis && current.thesis !== journalTemplates.beginner.thesis ? current.thesis : template.thesis,
      lesson: current.lesson && current.lesson !== journalTemplates.beginner.lesson ? current.lesson : template.lesson,
    }));
  }, [format]);

  const loadSavedTrades = async () => {
    if (!isAuthenticated || !user?.email) return;
    try {
      const res = await fetch(`${apiUrl("/trade_journals.php")}?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (data.status === "success") setSavedTrades(data.trades || []);
    } catch {
      setMessage("Could not load your previous trade journals.");
    }
  };

  useEffect(() => {
    loadSavedTrades();
  }, [isAuthenticated, user?.email]);

  const getDemoIdea = async () => {
    setIdeaLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${apiUrl("/demo_trade.php")}?asset=${encodeURIComponent(form.asset)}`);
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "Demo idea failed");
      setDemo(data);
      setForm((current) => ({
        ...current,
        entry_price: data.latest_price || current.entry_price,
        thesis: `${data.bias}: ${data.idea}`,
      }));
    } catch (err) {
      setMessage(err.message || "Could not fetch demo idea.");
    } finally {
      setIdeaLoading(false);
    }
  };

  const saveJournal = async () => {
    if (!isAuthenticated || !user?.email) {
      setMessage("Please log in before saving your trade journal.");
      return;
    }
    if (!form.thesis.trim() && !form.lesson.trim()) {
      setMessage("Write a thesis or lesson before saving.");
      return;
    }

    const entry = [
      `Trade Journal - ${journalTemplates[format].label}`,
      `Asset: ${form.asset.toUpperCase()} (${form.trade_type.toUpperCase()})`,
      `Capital/Risk: ${form.capital || "-"} / ${form.risk || "-"}`,
      `Thesis: ${form.thesis || "-"}`,
      `Lesson/Review: ${form.lesson || "-"}`,
    ].join("\n");

    setSaving(true);
    setMessage("");
    try {
      const data = await postJson("/save_entry.php", {
        ...authUserPayload(user),
        entry,
        entry_text: entry,
        emotion: form.emotion,
        mood: form.emotion,
        trade_type: form.trade_type,
        asset: form.asset,
        entry_price: form.entry_price,
        exit_price: form.exit_price,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not save journal.");
      setMessage("Trade journal saved. Review it after the market moves.");
      setForm(emptyForm);
      setFormat("beginner");
      loadSavedTrades();
    } catch (err) {
      setMessage(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTrade = async (tradeId) => {
    if (!user?.email) return;
    try {
      const data = await postJson("/trade_journals.php", {
        email: user.email,
        action: "delete",
        trade_id: tradeId,
      });
      if (data.status !== "success") throw new Error(data.message || "Delete failed");
      setSavedTrades((current) => current.filter((trade) => Number(trade.id) !== Number(tradeId)));
      setMessage("Previous practice trade deleted.");
    } catch (err) {
      setMessage(err.message || "Could not delete this trade.");
    }
  };

  return (
    <main className="min-h-screen bg-[#07130f] px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl border border-emerald-400/20 bg-slate-950/80 p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Trade Journal Desk</p>
          <h1 className="mt-3 text-4xl font-black text-white">Plan, paper trade, review, improve</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300">
            Built for crypto traders, stock learners, and commerce students. Pick a format, write the plan before action,
            and keep every practice trade available for later review.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(journalTemplates).map(([key, template]) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                  format === key ? "bg-emerald-400 text-slate-950" : "bg-slate-900 text-slate-300"
                }`}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
            {message}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-xl border border-emerald-400/20 bg-slate-950 p-5 shadow-xl">
            <div className="mb-5 flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-emerald-300" />
              <h2 className="text-lg font-black text-white">New Journal Entry</h2>
            </div>
            <div className="mb-5 rounded-xl border border-emerald-400/20 bg-slate-900 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Selected format</p>
              <p className="mt-2 text-lg font-black text-white">{journalTemplates[format].label}</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-300">
                This template changes the style of journaling. Beginners get guided prompts; experienced users get tighter planning space.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Asset / Subject
                <input value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value.toUpperCase() })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-semibold normal-case tracking-normal text-white" />
              </label>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Type
                <select value={form.trade_type} onChange={(e) => setForm({ ...form, trade_type: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-semibold text-white">
                  <option value="buy">Buy / Long</option>
                  <option value="sell">Sell / Exit</option>
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Entry price
                <input type="number" value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-semibold normal-case tracking-normal text-white" />
              </label>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Exit / target price
                <input type="number" value={form.exit_price} onChange={(e) => setForm({ ...form, exit_price: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-semibold normal-case tracking-normal text-white" />
              </label>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Capital used
                <input value={form.capital} onChange={(e) => setForm({ ...form, capital: e.target.value })} placeholder="Example: $100 paper trade" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-semibold normal-case tracking-normal text-white" />
              </label>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Risk / invalidation
                <input value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-semibold normal-case tracking-normal text-white" />
              </label>
            </div>

            <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-slate-400">
              Thesis / business idea
              <textarea value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} rows="5" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-medium normal-case tracking-normal text-white" />
            </label>
            <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-slate-400">
              Review / lesson
              <textarea value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} rows="4" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-medium normal-case tracking-normal text-white" />
            </label>

            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={saveJournal} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Trade Journal
              </button>
              <button onClick={getDemoIdea} disabled={ideaLoading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
                {ideaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Free Demo Idea
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-400/20 bg-slate-950 p-5 shadow-xl">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-300" />
                <h2 className="text-lg font-black text-white">Demo Trade From Past Data</h2>
              </div>
              {demo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Latest" value={`$${Number(demo.latest_price || 0).toLocaleString("en-US")}`} />
                    <Stat label="7D Avg" value={`$${Number(demo.avg_7d || 0).toLocaleString("en-US")}`} />
                    <Stat label="24H" value={`${demo.change_24h_percent}%`} />
                    <Stat label="30D" value={`${demo.change_30d_percent}%`} />
                  </div>
                  <div className="h-64">
                    <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                  </div>
                  <p className="rounded-lg bg-emerald-400/10 p-3 text-sm font-semibold leading-6 text-emerald-100">{demo.idea}</p>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-900 p-4 text-sm leading-6 text-slate-300">
                  Type BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, or any Binance USDT symbol and request a free paper-trade idea.
                  This is for learning and journaling, not financial advice.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-emerald-400/20 bg-slate-950 p-5 shadow-xl">
              <div className="mb-4 flex items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5 text-emerald-300" />
                <h2 className="text-lg font-black text-white">How a new user should practice</h2>
              </div>
              <div className="grid gap-3 text-sm font-semibold">
                <p className="rounded-lg bg-slate-900 p-3 text-slate-300">1. Start with the `Beginner Worksheet` format and only use demo ideas.</p>
                <p className="rounded-lg bg-slate-900 p-3 text-slate-300">2. Write the reason before the trade. If you cannot explain it, skip it.</p>
                <p className="rounded-lg bg-slate-900 p-3 text-slate-300">3. Come back later and judge your process, not only profit.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-400/20 bg-slate-950 p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">Previous Practice Trades</h2>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{savedTrades.length} saved</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-3">Date</th>
                  <th className="py-3">Asset</th>
                  <th className="py-3">Type</th>
                  <th className="py-3">Entry</th>
                  <th className="py-3">Exit</th>
                  <th className="py-3"></th>
                </tr>
              </thead>
              <tbody>
                {savedTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-slate-900">
                    <td className="py-3 text-slate-300">{formatIndiaDate(trade.trade_date || trade.created_at)}</td>
                    <td className="py-3 font-black text-emerald-200">{trade.asset}</td>
                    <td className="py-3 uppercase text-slate-300">{trade.trade_type}</td>
                    <td className="py-3 text-slate-300">{trade.buy_price || "-"}</td>
                    <td className="py-3 text-slate-300">{trade.sell_price || "-"}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => deleteTrade(trade.id)} className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-black text-red-300">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!savedTrades.length && (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-500">
                      No demo trades saved yet. Create one above and it will appear here for review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-900 p-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
