import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle2,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { apiUrl, postJson } from "../lib/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeAddress(address) {
  return String(address || "").trim().toLowerCase();
}

export default function TraderDashboard() {
  const { user, isAuthenticated } = useAuth0();
  const [walletAddress, setWalletAddress] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [walletType, setWalletType] = useState("evm");
  const [walletData, setWalletData] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [analysisProvider, setAnalysisProvider] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const autoAnalyzed = useRef(false);

  const loadSavedWallet = useCallback(async () => {
    if (!isAuthenticated || !user?.email) return;

    try {
      const data = await postJson("/get_wallet.php", { email: user.email });
      if (data.status === "success" && data.wallet_address) {
        setWalletAddress(data.wallet_address);
        setManualAddress(data.wallet_address);
        setWalletType(data.wallet_type || "evm");
      }
    } catch {
      setError("Could not load your saved wallet.");
    }
  }, [isAuthenticated, user?.email]);

  const fetchWalletData = useCallback(
    async (address = walletAddress) => {
      const cleanAddress = normalizeAddress(address);
      if (!cleanAddress || !user?.email) return;

      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${apiUrl("/getWalletData.php")}?address=${encodeURIComponent(
            cleanAddress
          )}&email=${encodeURIComponent(user.email)}`
        );
        const data = await res.json();
        if (data.status !== "success") {
          throw new Error(data.message || "Wallet data fetch failed.");
        }
        setWalletData(data);
      } catch (err) {
        setError(err.message || "Unable to fetch wallet data.");
      } finally {
        setLoading(false);
      }
    },
    [user?.email, walletAddress]
  );

  useEffect(() => {
    loadSavedWallet();
  }, [loadSavedWallet]);

  useEffect(() => {
    if (walletAddress && user?.email) fetchWalletData(walletAddress);
  }, [walletAddress, user?.email, fetchWalletData]);

  const saveWalletAddress = async (address, type = "evm") => {
    const cleanAddress = normalizeAddress(address);
    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
      throw new Error("Enter a valid EVM wallet address.");
    }

    const data = await postJson("/save_wallet.php", {
      email: user.email,
      wallet_address: cleanAddress,
      wallet_type: type,
    });
    if (data.status !== "success") {
      throw new Error(data.message || "Could not save wallet.");
    }

    setWalletAddress(cleanAddress);
    setManualAddress(cleanAddress);
    setWalletType(data.wallet_type || type);
    return cleanAddress;
  };

  const connectWallet = async () => {
    setError("");
    setStatus("");

    if (!window.ethereum) {
      setError("No browser wallet was detected. You can paste a public wallet address below instead.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const address = await saveWalletAddress(accounts?.[0], "browser_wallet");
      setStatus("Browser wallet connected and saved.");
      fetchWalletData(address);
    } catch (err) {
      setError(err.message || "Wallet connection failed.");
    }
  };

  const saveManualWallet = async () => {
    setError("");
    setStatus("");

    try {
      const address = await saveWalletAddress(manualAddress, "manual_evm");
      setStatus("Public wallet address saved.");
      fetchWalletData(address);
    } catch (err) {
      setError(err.message || "Could not save wallet address.");
    }
  };

  const analyzeTrades = async () => {
    if (!user?.email) return;

    setAnalyzing(true);
    setError("");
    setAnalysis("");
    try {
      const data = await postJson("/analyze_trades.php", { email: user.email });
      if (data.status !== "success") {
        throw new Error(data.message || "AI analysis failed.");
      }
      const feedback = String(data.feedback || "").trim();
      setAnalysis(feedback || starterCoachText);
      setAnalysisProvider(data.provider || "");
    } catch (err) {
      setAnalysis(starterCoachText);
      setAnalysisProvider("local coach");
      setError(err.message || "Unable to analyze trades, showing starter coaching instead.");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!user?.email || autoAnalyzed.current) return;
    autoAnalyzed.current = true;
    analyzeTrades();
  }, [user?.email]);

  const portfolio = walletData?.portfolio || {};
  const emptyState = walletData?.empty_state || {};
  const balances = walletData?.balances || [];
  const transactions = walletData?.transactions || [];
  const profitLoss = Number(portfolio.profit_loss || 0);
  const profitLossPercent = Number(portfolio.profit_loss_percent || 0);
  const isProfit = profitLoss >= 0;
  const progressScore = Math.min(
    100,
    (walletAddress ? 25 : 0) +
      (balances.length || transactions.length ? 25 : 0) +
      (Number(portfolio.trade_count || 0) > 0 ? 25 : 0) +
      (analysis ? 25 : 0)
  );

  const portfolioChart = useMemo(() => {
    const points = walletData?.history || [];
    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          label: "Portfolio value",
          data: points.map((p) => p.value_usd ?? p.value_inr ?? 0),
          borderColor: "#0f766e",
          backgroundColor: "rgba(15, 118, 110, 0.12)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [walletData]);

  const pnlChart = useMemo(() => {
    const points = walletData?.history || [];
    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          label: "Profit / Loss",
          data: points.map((p) => p.pnl_usd ?? p.pnl_inr ?? 0),
          backgroundColor: points.map((p) =>
            Number(p.pnl_usd ?? p.pnl_inr ?? 0) >= 0 ? "#16a34a" : "#dc2626"
          ),
        },
      ],
    };
  }, [walletData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { ticks: { callback: (value) => currency.format(value) } },
    },
  };

  return (
    <main className="min-h-screen bg-[#07130f] px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-xl border border-emerald-400/20 bg-slate-950/80 p-6 shadow-2xl md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-300">
              Trader Journal
            </p>
            <h1 className="mt-2 text-4xl font-black text-white">
              Wallet Tracker
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={connectWallet}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:bg-emerald-300"
            >
              <Wallet className="h-4 w-4" />
              {walletAddress ? "Reconnect Browser Wallet" : "Connect Browser Wallet"}
            </button>
            <button
              onClick={() => fetchWalletData()}
              disabled={!walletAddress || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-100 shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {(error || status) && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${
              error
                ? "border-red-400/30 bg-red-400/10 text-red-100"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
            }`}
          >
            {error ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            {error || status}
          </div>
        )}

        <section className="rounded-xl border border-emerald-400/20 bg-slate-950 p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Progress</p>
              <h2 className="text-lg font-black text-white">Trading desk setup</h2>
            </div>
            <span className="text-2xl font-black text-emerald-300">{progressScore}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progressScore}%` }} />
          </div>
          <div className="mt-3 grid gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 md:grid-cols-4">
            <span className={walletAddress ? "text-emerald-300" : ""}>Wallet</span>
            <span className={balances.length || transactions.length ? "text-emerald-300" : ""}>Activity</span>
            <span className={Number(portfolio.trade_count || 0) > 0 ? "text-emerald-300" : ""}>Trades</span>
            <span className={analysis ? "text-emerald-300" : ""}>AI Review</span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
              Wallet
            </p>
            <p className="mt-3 break-all text-lg font-black text-stone-900">
              {walletAddress ? shortAddress(walletAddress) : "Not connected"}
            </p>
            {walletAddress && (
              <>
                <p className="mt-2 break-all text-xs text-stone-500">
                  {walletAddress}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-teal-700">
                  {walletType.replace(/_/g, " ")}
                </p>
              </>
            )}
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
              Portfolio Value
            </p>
            <p className="mt-3 text-3xl font-black text-stone-900">
              {currency.format(Number(portfolio.current_value_usd ?? portfolio.current_value_inr ?? 0))}
            </p>
            <p className="mt-2 text-xs font-semibold text-stone-500">
              {loading ? "Fetching wallet data..." : `${balances.length} token balance${balances.length === 1 ? "" : "s"} found`}
            </p>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
              Profit / Loss
            </p>
            <p
              className={`mt-3 flex items-center gap-2 text-3xl font-black ${
                isProfit ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {isProfit ? (
                <TrendingUp className="h-7 w-7" />
              ) : (
                <TrendingDown className="h-7 w-7" />
              )}
              {currency.format(profitLoss)}
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-500">
              {profitLossPercent.toFixed(2)}%
            </p>
            <p className="mt-2 text-xs font-semibold text-stone-500">
              {Number(portfolio.trade_count || 0)} saved trade{Number(portfolio.trade_count || 0) === 1 ? "" : "s"}
            </p>
          </div>
        </section>

        {walletData && (emptyState.wallet_message || emptyState.trade_message) && (
          <section className="grid gap-3 md:grid-cols-2">
            {emptyState.wallet_message && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {emptyState.wallet_message}
              </div>
            )}
            {emptyState.trade_message && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
                {emptyState.has_trades
                  ? emptyState.trade_message
                  : "You have not logged any trades yet. Add trade details in your journal to track progress and P/L."}
              </div>
            )}
          </section>
        )}

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-xs font-bold uppercase tracking-widest text-stone-500">
              Save public wallet address
              <input
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x..."
                className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-stone-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <button
              onClick={saveManualWallet}
              disabled={!manualAddress}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" />
              Save Address
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-black text-stone-900">
                Portfolio Over Time
              </h2>
            </div>
            <div className="h-72">
              <Line data={portfolioChart} options={chartOptions} />
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-black text-stone-900">
                Profit / Loss Chart
              </h2>
            </div>
            <div className="h-72">
              <Bar data={pnlChart} options={chartOptions} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-stone-900">
              Token Balances
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-stone-100 text-xs uppercase tracking-widest text-stone-500">
                  <tr>
                    <th className="py-3">Asset</th>
                    <th className="py-3">Balance</th>
                    <th className="py-3">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((token) => (
                    <tr key={token.contract_address || token.symbol} className="border-b border-stone-100">
                      <td className="py-3 font-bold text-stone-800">
                        {token.symbol || token.name}
                      </td>
                      <td className="py-3 text-stone-600">
                        {Number(token.balance || 0).toLocaleString("en-IN", {
                          maximumFractionDigits: 6,
                        })}
                      </td>
                      <td className="py-3 font-semibold text-stone-800">
                        {currency.format(Number(token.value_usd ?? token.value_inr ?? 0))}
                      </td>
                    </tr>
                  ))}
                  {!balances.length && (
                    <tr>
                      <td className="py-10 text-center text-stone-400" colSpan="3">
                        {walletAddress
                          ? "No non-zero Ethereum token balances found for this wallet."
                          : "Connect a wallet to see balances."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-stone-900">AI Coach</h2>
              <button
                onClick={analyzeTrades}
                disabled={analyzing}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-800 disabled:opacity-50"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                Analyze with Sarvam
              </button>
            </div>
            {analysisProvider && (
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-teal-700">
                Powered by {analysisProvider}
              </p>
            )}
            <div className="min-h-56 whitespace-pre-wrap rounded-lg bg-stone-50 p-4 text-sm leading-6 text-stone-700">
              {analysis ||
                "Save trading journal entries or connect wallet activity, then ask Sarvam for progress, risk feedback, and ideas."}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-stone-900">Recent Wallet Activity</h2>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-500">
              {transactions.length} event{transactions.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-stone-100 text-xs uppercase tracking-widest text-stone-500">
                <tr>
                  <th className="py-3">Type</th>
                  <th className="py-3">Asset</th>
                  <th className="py-3">Value</th>
                  <th className="py-3">From</th>
                  <th className="py-3">To</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr key={`${tx.hash || tx.uniqueId || "tx"}-${index}`} className="border-b border-stone-100">
                    <td className="py-3 font-bold text-stone-800">{tx.category || "transfer"}</td>
                    <td className="py-3 text-stone-600">{tx.asset || "ETH"}</td>
                    <td className="py-3 text-stone-600">{tx.value ?? "-"}</td>
                    <td className="py-3 font-mono text-xs text-stone-500">{shortAddress(tx.from || "")}</td>
                    <td className="py-3 font-mono text-xs text-stone-500">{shortAddress(tx.to || "")}</td>
                  </tr>
                ))}
                {!transactions.length && (
                  <tr>
                    <td className="py-10 text-center text-stone-400" colSpan="5">
                      {walletAddress
                        ? "You have done nothing in this wallet yet, or no Ethereum activity was found by the wallet API."
                        : "Connect a wallet to see transaction history."}
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

const starterCoachText =
  "You have not logged enough trades yet, so here is your starter plan:\n\n" +
  "- Create one paper trade idea before entering the market: asset, thesis, entry, invalidation, and target.\n" +
  "- Risk a fixed small amount on every demo trade so your results are comparable.\n" +
  "- After 24 hours, review whether you followed your plan, not only whether price moved up or down.\n" +
  "- Commerce student angle: write capital used, expected return, break-even thinking, and what can go wrong.\n" +
  "- Next action: open Trade Journal and save your first demo trade.";
