import { BookOpen, BriefcaseBusiness, Calculator, CheckCircle2, FileCode2, LineChart, Save, X } from "lucide-react";
import { postJson } from "../lib/api";

export const defaultWorkspacePrefs = {
  use_personal: true,
  use_trading: true,
  use_accounting: false,
  use_commerce: false,
  use_programming: true,
  experience_level: "beginner",
};

export function normalizePrefs(prefs = {}) {
  return {
    ...defaultWorkspacePrefs,
    ...prefs,
    use_personal: Boolean(Number(prefs.use_personal ?? defaultWorkspacePrefs.use_personal)),
    use_trading: Boolean(Number(prefs.use_trading ?? defaultWorkspacePrefs.use_trading)),
    use_accounting: Boolean(Number(prefs.use_accounting ?? defaultWorkspacePrefs.use_accounting)),
    use_commerce: Boolean(Number(prefs.use_commerce ?? defaultWorkspacePrefs.use_commerce)),
    use_programming: Boolean(Number(prefs.use_programming ?? defaultWorkspacePrefs.use_programming)),
  };
}

export function savePrefsLocal(prefs) {
  localStorage.setItem("silentlines_prefs", JSON.stringify(prefs));
  window.dispatchEvent(new Event("silentlines-prefs-updated"));
}

export default function WorkspaceSettings({ userEmail, prefs, setPrefs, onClose, forceOpen = false }) {
  const togglePref = (key) => setPrefs((current) => ({ ...current, [key]: !current[key] }));

  const savePrefs = async () => {
    if (!userEmail) return;
    const data = await postJson("/user_preferences.php", { email: userEmail, ...prefs });
    if (data.status === "success") {
      const normalized = normalizePrefs(data.preferences);
      setPrefs(normalized);
      savePrefsLocal(normalized);
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-stretch justify-center overflow-y-auto bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="flex min-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[92dvh] sm:min-h-0 sm:max-w-2xl sm:rounded-lg sm:border sm:border-emerald-400/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-settings-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Workspace Settings</p>
            <h2 id="workspace-settings-title" className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
              Choose what SilentLines shows you
            </h2>
          </div>
          {!forceOpen && (
            <button
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Close workspace settings"
              title="Close settings"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-6">
          <p className="text-sm font-medium leading-6 text-slate-600">
            Turn tools on or off anytime. Your menu, journal prompts, and learning style will follow these preferences.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PrefButton prefKey="use_trading" active={prefs.use_trading} onClick={() => togglePref("use_trading")} icon={LineChart} title="Trading practice" text="Paper trades, wallet tracker, AI review." />
            <PrefButton prefKey="use_accounting" active={prefs.use_accounting} onClick={() => togglePref("use_accounting")} icon={Calculator} title="Accounts & Tally" text="Vouchers, ledgers, trial balance, reports." />
            <PrefButton prefKey="use_commerce" active={prefs.use_commerce} onClick={() => togglePref("use_commerce")} icon={BriefcaseBusiness} title="Commerce projects" text="Capital, GST notes, cash flow, break-even." />
            <PrefButton prefKey="use_programming" active={prefs.use_programming} onClick={() => togglePref("use_programming")} icon={FileCode2} title="Programming journal" text="Code notes, snippets, sandbox preview." />
            <PrefButton prefKey="use_personal" active={prefs.use_personal} onClick={() => togglePref("use_personal")} icon={BookOpen} title="Personal diary" text="Mood writing and private journal." />
          </div>
          <label className="mt-5 block text-xs font-black uppercase tracking-widest text-slate-500">
            Experience
            <select
              value={prefs.experience_level}
              onChange={(e) => setPrefs({ ...prefs, experience_level: e.target.value })}
              className="mt-2 min-h-12 w-full rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-900"
              aria-label="Experience level"
            >
              <option value="beginner">Beginner - teach me step by step</option>
              <option value="student">Student - I know basics</option>
              <option value="trader">Trader - keep it direct</option>
            </select>
          </label>
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:p-6 sm:shadow-none">
          <button
            onClick={savePrefs}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white"
            aria-label="Save workspace preferences"
          >
            <Save className="h-4 w-4" />
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

function PrefButton({ active, onClick, icon: Icon, title, text, prefKey }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${title}. ${active ? "Enabled" : "Disabled"}. ${text}`}
      className={`min-h-28 rounded-lg border p-4 text-left transition ${
        active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Icon className={`h-5 w-5 ${active ? "text-emerald-700" : "text-slate-500"}`} />
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase ${
          active ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
        }`}>
          {active && <CheckCircle2 className="h-3 w-3" />}
          {active ? "On" : "Off"}
        </span>
      </div>
      <p id={`${prefKey}-title`} className="font-black text-slate-950">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{text}</p>
    </button>
  );
}
