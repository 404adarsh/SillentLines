import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Ban, BookOpen, BriefcaseBusiness, Calculator, ExternalLink, FileCode2, GripVertical, Home, Info, KeyRound, LineChart, Loader2, LockKeyhole, Mail, Palette, RefreshCcw, Save, Search, Settings2, Shield, SmilePlus, SunMedium, Type, Upload, User, UsersRound, X } from "lucide-react";
import { apiUrl, postJson } from "../lib/api";
import { defaultWorkspacePrefs, normalizePrefs, savePrefsLocal } from "../component/WorkspaceSettings";
import { defaultEditorCustomize, menuShortcutOptions, normalizeEditorCustomize, resetEditorCustomize, requiredEditorButtons, shrinkImageFile } from "../lib/writingCustomize";
import { publicUserLabel, publicUsername } from "../lib/format";

const effectOptions = [
  { id: "paper", label: "Paper" },
  { id: "sparkle", label: "Sparkle" },
  { id: "glow", label: "Glow" },
  { id: "rain", label: "Rain" },
  { id: "night", label: "Night" },
];

const stickerOptions = [
  { id: "star", label: "Star" },
  { id: "heart", label: "Heart" },
  { id: "note", label: "Note" },
  { id: "spark", label: "Spark" },
  { id: "moon", label: "Moon" },
  { id: "flower", label: "Flower" },
];

export default function SettingsPage() {
  const { user } = useAuth0();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(defaultWorkspacePrefs);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [resettingLock, setResettingLock] = useState(false);
  const [customize, setCustomize] = useState(defaultEditorCustomize);
  const [savingCustomize, setSavingCustomize] = useState(false);
  const [draggingButtonId, setDraggingButtonId] = useState("");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockUsername, setBlockUsername] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({ disable_all: 0, allow_only_selected_senders: 0 });
  const [allowedSenders, setAllowedSenders] = useState([]);
  const [senderSearch, setSenderSearch] = useState("");
  const [senderResults, setSenderResults] = useState([]);
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false);
  const [lock, setLock] = useState({
    is_enabled: false,
    prompt_frequency: "every_visit",
    recovery_hint: "",
    password: "",
  });

  useEffect(() => {
    const load = async () => {
      if (!user?.email) return;
      try {
        const res = await fetch(`${apiUrl("/user_preferences.php")}?email=${encodeURIComponent(user.email)}`);
        const data = await res.json();
        if (data.status === "success" && data.preferences) {
          setPrefs(normalizePrefs(data.preferences));
        }
        const lockRes = await fetch(`${apiUrl("/diary_lock.php")}?email=${encodeURIComponent(user.email)}`, {
          credentials: "include",
        });
        const lockData = await lockRes.json().catch(() => ({}));
        if (lockData.status === "success" && lockData.settings) {
          setLock((current) => ({
            ...current,
            is_enabled: Number(lockData.settings.is_enabled) === 1,
            prompt_frequency: lockData.settings.prompt_frequency || "every_visit",
            recovery_hint: lockData.settings.recovery_hint || "",
          }));
        }
        const customizeRes = await fetch(`${apiUrl("/writing_customization.php")}?email=${encodeURIComponent(user.email)}`, {
          credentials: "include",
        });
        const customizeData = await customizeRes.json().catch(() => ({}));
        if (customizeData.status === "success") {
          setCustomize(normalizeEditorCustomize(customizeData.customization));
        }
        const blockedRes = await fetch(`${apiUrl("/get_blocked_users.php")}?email=${encodeURIComponent(user.email)}`, {
          credentials: "include",
        });
        const blockedData = await blockedRes.json().catch(() => ({}));
        if (blockedData.status === "success") {
          setBlockedUsers(blockedData.users || []);
        }
        try {
          const emailPrefRes = await fetch(`${apiUrl("/email_preferences.php")}?email=${encodeURIComponent(user.email)}`, {
            credentials: "include",
          });
          const emailPrefData = await emailPrefRes.json().catch(() => ({}));
          if (emailPrefData.status === "success") {
            setEmailPrefs(emailPrefData.preferences || { disable_all: 0, allow_only_selected_senders: 0 });
            setAllowedSenders(emailPrefData.allowed_senders || []);
          }
        } catch {
          setEmailPrefs({ disable_all: 0, allow_only_selected_senders: 0 });
          setAllowedSenders([]);
        }
      } catch {
        setMessage("Could not load your settings.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.email]);

  const toggle = (key) => setPrefs((current) => ({ ...current, [key]: !current[key] }));

  const save = async () => {
    if (!user?.email) return;
    const data = await postJson("/user_preferences.php", { email: user.email, ...prefs });
    if (data.status === "success") {
      savePrefsLocal(normalizePrefs(data.preferences));
      setMessage("Workspace settings updated.");
    } else {
      setMessage(data.message || "Could not save settings.");
    }
  };

  const saveLock = async () => {
    if (!user?.email) return;
    try {
      const data = await postJson("/diary_lock.php", {
        email: user.email,
        action: "save",
        is_enabled: lock.is_enabled ? 1 : 0,
        prompt_frequency: lock.prompt_frequency,
        recovery_hint: lock.recovery_hint,
        password: lock.password,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not save diary lock.");
      if (data.settings) {
        setLock((current) => ({
          ...current,
          is_enabled: Number(data.settings.is_enabled) === 1,
          prompt_frequency: data.settings.prompt_frequency || current.prompt_frequency,
          recovery_hint: data.settings.recovery_hint || "",
          password: "",
        }));
        clearLockUnlocks(user.email);
        window.dispatchEvent(new CustomEvent("silentlines-lock-updated", { detail: { settings: data.settings } }));
      } else {
        setLock((current) => ({ ...current, password: "" }));
        clearLockUnlocks(user.email);
        window.dispatchEvent(new Event("silentlines-lock-updated"));
      }
      setMessage(lock.is_enabled ? "Diary lock updated. Your next protected visit will ask for the password." : "Diary lock turned off.");
    } catch (err) {
      setMessage(err.message || "Could not save diary lock.");
    }
  };

  const sendNewLockPassword = async () => {
    if (!user?.email || resettingLock) return;
    setResettingLock(true);
    try {
      const data = await postJson("/diary_lock.php", {
        email: user.email,
        action: "forgot_password",
      });
      if (data.status !== "success") throw new Error(data.message || "Could not send a new diary password.");
      if (data.settings) {
        setLock((current) => ({
          ...current,
          is_enabled: Number(data.settings.is_enabled) === 1,
          prompt_frequency: data.settings.prompt_frequency || current.prompt_frequency,
          recovery_hint: data.settings.recovery_hint || "",
          password: "",
        }));
        clearLockUnlocks(user.email);
        window.dispatchEvent(new CustomEvent("silentlines-lock-updated", { detail: { settings: data.settings } }));
      }
      const remainingText = Number.isFinite(Number(data.resets_remaining))
        ? ` ${data.resets_remaining} reset${Number(data.resets_remaining) === 1 ? "" : "s"} left this month.`
        : "";
      setMessage(`${data.message || "A new diary password has been sent to your registered email."}${remainingText}`);
    } catch (err) {
      setMessage(err.message || "Could not send a new diary password.");
    } finally {
      setResettingLock(false);
    }
  };

  const updateCustomizeButton = (id, patch) => {
    setCustomize((current) => ({
      ...current,
      buttons: current.buttons.map((button) => button.id === id ? { ...button, ...patch } : button),
    }));
  };

  const moveCustomizeButton = (id, direction) => {
    setCustomize((current) => {
      const buttons = [...current.buttons];
      const index = buttons.findIndex((button) => button.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= buttons.length) return current;
      const target = buttons[nextIndex];
      if (requiredEditorButtons.has(target.id) && !requiredEditorButtons.has(id)) return current;
      [buttons[index], buttons[nextIndex]] = [buttons[nextIndex], buttons[index]];
      return { ...current, buttons };
    });
  };

  const handleButtonDrop = (targetId) => {
    if (!draggingButtonId || draggingButtonId === targetId) return;
    setCustomize((current) => {
      const buttons = [...current.buttons];
      const from = buttons.findIndex((button) => button.id === draggingButtonId);
      const to = buttons.findIndex((button) => button.id === targetId);
      if (from < 0 || to < 0) return current;
      const dragged = buttons[from];
      if (requiredEditorButtons.has(dragged.id) && dragged.id !== targetId) return current;
      if (requiredEditorButtons.has(buttons[to].id) && dragged.id !== buttons[to].id) return current;
      buttons.splice(from, 1);
      buttons.splice(to, 0, dragged);
      return { ...current, buttons };
    });
    setDraggingButtonId("");
  };

  const toggleCustomizeList = (key, value) => {
    setCustomize((current) => {
      const list = Array.isArray(current[key]) ? current[key] : [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  };

  const toggleMenuShortcut = (id) => toggleCustomizeList("menu_shortcuts", id);

  const importLogo = async (file) => {
    if (!file) return;
    try {
      const image = await shrinkImageFile(file, 420);
      setCustomize((current) => ({ ...current, logo_image: image }));
    } catch (err) {
      setMessage(err.message || "Could not load logo image.");
    }
  };

  const saveCustomize = async (nextCustomize = customize) => {
    if (!user?.email) return;
    setSavingCustomize(true);
    try {
      const normalized = normalizeEditorCustomize(nextCustomize);
      const data = await postJson("/writing_customization.php", {
        email: user.email,
        action: "save",
        customization: normalized,
      });
      const saved = normalizeEditorCustomize(data.customization);
      setCustomize(saved);
      window.dispatchEvent(new CustomEvent("silentlines-writing-customized", { detail: { customization: saved } }));
      setMessage("Writing customization saved.");
    } catch (err) {
      setMessage(err.message || "Could not save writing customization.");
    } finally {
      setSavingCustomize(false);
    }
  };

  const resetCustomize = async () => {
    if (!user?.email) return;
    setSavingCustomize(true);
    try {
      const data = await postJson("/writing_customization.php", {
        email: user.email,
        action: "reset",
        customization: resetEditorCustomize(),
      });
      const saved = normalizeEditorCustomize(data.customization);
      setCustomize(saved);
      window.dispatchEvent(new CustomEvent("silentlines-writing-customized", { detail: { customization: saved } }));
      setMessage("Writing customization reset.");
    } catch (err) {
      setMessage(err.message || "Could not reset writing customization.");
    } finally {
      setSavingCustomize(false);
    }
  };

  const blockUser = async () => {
    if (!user?.email || !blockUsername.trim()) return;
    setSavingBlock(true);
    try {
      const data = await postJson("/block_user.php", {
        email: user.email,
        action: "block",
        username: blockUsername.trim(),
      });
      if (data.status !== "success") throw new Error(data.message || "Could not block user.");
      setBlockedUsers((current) => [data.user, ...current.filter((item) => Number(item.id) !== Number(data.user.id))]);
      setBlockUsername("");
      setMessage(data.message || "User blocked.");
    } catch (err) {
      setMessage(err.message || "Could not block user.");
    } finally {
      setSavingBlock(false);
    }
  };

  const unblockUser = async (blockedUserId) => {
    if (!user?.email) return;
    setSavingBlock(true);
    try {
      const data = await postJson("/block_user.php", {
        email: user.email,
        action: "unblock",
        blocked_user_id: blockedUserId,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not unblock user.");
      setBlockedUsers((current) => current.filter((item) => Number(item.id) !== Number(blockedUserId)));
      setMessage(data.message || "User unblocked.");
    } catch (err) {
      setMessage(err.message || "Could not unblock user.");
    } finally {
      setSavingBlock(false);
    }
  };

  const applyEmailPayload = (data) => {
    setEmailPrefs(data.preferences || { disable_all: 0, allow_only_selected_senders: 0 });
    setAllowedSenders(data.allowed_senders || []);
  };

  const saveEmailPreferences = async (nextPrefs = emailPrefs) => {
    if (!user?.email) return;
    setSavingEmailPrefs(true);
    try {
      const data = await postJson("/email_preferences.php", {
        email: user.email,
        action: "save",
        disable_all: nextPrefs.disable_all ? 1 : 0,
        allow_only_selected_senders: nextPrefs.allow_only_selected_senders ? 1 : 0,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not save email preferences.");
      applyEmailPayload(data);
      setMessage("Email preferences saved.");
    } catch (err) {
      setMessage(err.message || "Could not save email preferences.");
    } finally {
      setSavingEmailPrefs(false);
    }
  };

  const searchAllowedSenders = async () => {
    if (!user?.email || senderSearch.trim().length < 2) return;
    try {
      const data = await postJson("/search_user.php", {
        email: user.email,
        query: senderSearch.trim(),
      });
      setSenderResults(data.users || []);
    } catch {
      setSenderResults([]);
    }
  };

  const addAllowedSender = async (senderId) => {
    if (!user?.email) return;
    setSavingEmailPrefs(true);
    try {
      const data = await postJson("/email_preferences.php", {
        email: user.email,
        action: "add_sender",
        sender_user_id: senderId,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not allow this sender.");
      applyEmailPayload(data);
      setSenderSearch("");
      setSenderResults([]);
      setMessage("Allowed sender saved.");
    } catch (err) {
      setMessage(err.message || "Could not allow this sender.");
    } finally {
      setSavingEmailPrefs(false);
    }
  };

  const removeAllowedSender = async (senderId) => {
    if (!user?.email) return;
    setSavingEmailPrefs(true);
    try {
      const data = await postJson("/email_preferences.php", {
        email: user.email,
        action: "remove_sender",
        sender_user_id: senderId,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not remove this sender.");
      applyEmailPayload(data);
      setMessage("Allowed sender removed.");
    } catch (err) {
      setMessage(err.message || "Could not remove this sender.");
    } finally {
      setSavingEmailPrefs(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Settings2 className="h-6 w-6 text-emerald-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Settings</p>
              <h1 className="text-3xl font-black text-slate-950">Customize your workspace</h1>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium leading-6 text-slate-600">
            Change what this journal is mainly for, and we will keep the navigation and guidance focused on that use.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Use this to update your Auth0 credentials and local backend keys, including Alchemy, Sarvam, OpenAI, and email SMTP settings.
          </p>
          <button
            type="button"
            onClick={() => navigate("/settings?force_setup=1")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:bg-slate-100"
          >
            <KeyRound className="h-4 w-4" />
            Edit Auth0, backend keys, and email credentials
          </button>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div>}

        <section className="grid gap-4 md:grid-cols-2">
          <ModeCard active={prefs.use_trading} onClick={() => toggle("use_trading")} icon={LineChart} title="Trading practice" text="Paper trades, portfolio tracking, AI guidance, and review." />
          <ModeCard active={prefs.use_accounting} onClick={() => toggle("use_accounting")} icon={Calculator} title="Accounting school" text="Voucher practice, debit-credit entries, and Tally-style work." />
          <ModeCard active={prefs.use_commerce} onClick={() => toggle("use_commerce")} icon={BriefcaseBusiness} title="Commerce study" text="Cash flow, break-even, business planning, and decision journals." />
          <ModeCard active={prefs.use_programming} onClick={() => toggle("use_programming")} icon={FileCode2} title="Programming journal" text="Code notes, snippets, debugging logs, and lessons." />
          <ModeCard active={prefs.use_personal} onClick={() => toggle("use_personal")} icon={BookOpen} title="Personal diary" text="Private notes, moods, and regular reflection." />
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">
            Experience Level
            <select
              value={prefs.experience_level}
              onChange={(e) => setPrefs((current) => ({ ...current, experience_level: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-900"
            >
              <option value="beginner">Beginner - explain everything clearly</option>
              <option value="student">Student - guided but quicker</option>
              <option value="trader">Trader - focused and direct</option>
            </select>
          </label>
          <button onClick={save} disabled={loading} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white">
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ExternalLink className="h-6 w-6 text-slate-800" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">More Pages</p>
              <h2 className="text-2xl font-black text-slate-950">Shortcuts moved from the menu</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <SettingsLink to="/" icon={Home} label="Open SilentLines" />
            <SettingsLink to="/daily-workspace" icon={SunMedium} label="Daily Workspace" />
            <SettingsLink to="/profile" icon={User} label="My Profile" />
            <SettingsLink to="/trade-journal" icon={LineChart} label="Trade Journal" />
            <SettingsLink to="/dashboard" icon={LineChart} label="Portfolio" />
            <SettingsLink to="/accounts-journal" icon={Calculator} label="Accounts Journal" />
            <SettingsLink to="/programming-journal" icon={FileCode2} label="Programming Journal" />
            <SettingsLink to="/people" icon={UsersRound} label="People Memory" />
            <SettingsLink to="/about" icon={Info} label="Tutorial" />
            <SettingsLink to="/safety" icon={Shield} label="Safety" />
          </div>
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Hamburger Menu</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">Choose shortcuts to keep in the menu</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Tick the pages you want inside the hamburger menu. Unticked pages stay available here in Settings and through the navigation assistant.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {menuShortcutOptions.map((item) => (
                <label key={item.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={customize.menu_shortcuts.includes(item.id)}
                    onChange={() => toggleMenuShortcut(item.id)}
                    className="h-5 w-5 accent-slate-900"
                    aria-label={`${customize.menu_shortcuts.includes(item.id) ? "Remove" : "Add"} ${item.label} from hamburger menu`}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <button onClick={() => saveCustomize()} disabled={savingCustomize} className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-60">
              {savingCustomize ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Menu Shortcuts
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Ban className="h-6 w-6 text-red-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-red-700">Blocked Users</p>
              <h2 className="text-2xl font-black text-slate-950">Stop diary share requests by username</h2>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={blockUsername}
              onChange={(event) => setBlockUsername(event.target.value)}
              placeholder="Enter exact username"
              className="min-h-12 flex-1 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-red-100"
            />
            <button onClick={blockUser} disabled={savingBlock || !blockUsername.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 text-sm font-black text-white disabled:opacity-60">
              {savingBlock ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Block
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {blockedUsers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">No blocked users.</p>
            ) : blockedUsers.map((blocked) => (
              <div key={blocked.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{blocked.full_name || blocked.username}</p>
                  <p className="text-xs font-semibold text-slate-500">@{blocked.username}</p>
                </div>
                <button onClick={() => unblockUser(blocked.id)} disabled={savingBlock} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-60">
                  <X className="h-4 w-4" />
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-sky-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-sky-700">Email Preferences</p>
              <h2 className="text-2xl font-black text-slate-950">Control diary app emails</h2>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            These settings control collaboration invite and commit emails. Password recovery emails stay available so you do not get locked out.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
              <input
                type="checkbox"
                checked={Boolean(Number(emailPrefs.disable_all))}
                onChange={(event) => {
                  const next = { ...emailPrefs, disable_all: event.target.checked ? 1 : 0 };
                  setEmailPrefs(next);
                  saveEmailPreferences(next);
                }}
                className="mt-1 h-5 w-5 accent-sky-700"
                aria-label="Disable diary collaboration and commit emails"
              />
              <span>
                Disable diary emails
                <span className="block text-xs font-semibold leading-5 text-slate-500">Stop invite and commit emails from the diary app.</span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
              <input
                type="checkbox"
                checked={Boolean(Number(emailPrefs.allow_only_selected_senders))}
                onChange={(event) => {
                  const next = { ...emailPrefs, allow_only_selected_senders: event.target.checked ? 1 : 0 };
                  setEmailPrefs(next);
                  saveEmailPreferences(next);
                }}
                className="mt-1 h-5 w-5 accent-sky-700"
                aria-label="Only receive diary emails from selected people"
              />
              <span>
                Only selected people
                <span className="block text-xs font-semibold leading-5 text-slate-500">When on, diary emails are sent only if the sender is in your allowed list.</span>
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Allowed Email Senders</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                <input
                  value={senderSearch}
                  onChange={(event) => setSenderSearch(event.target.value)}
                  placeholder="Search username or name"
                  className="min-h-12 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-sky-100"
                  aria-label="Search people to allow diary emails from"
                />
              </div>
              <button onClick={searchAllowedSenders} disabled={senderSearch.trim().length < 2} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-60">
                <Search className="h-4 w-4" />
                Search
              </button>
            </div>
            {senderResults.length > 0 && (
              <div className="mt-3 grid gap-2">
                {senderResults.map((item) => (
                  <button key={item.id} onClick={() => addAllowedSender(item.id)} className="flex items-center justify-between rounded-lg bg-white p-3 text-left hover:bg-sky-50">
                    <span>
                      <span className="block text-sm font-black text-slate-950">{publicUserLabel(item)}</span>
                      {publicUsername(item) && <span className="block text-xs font-semibold text-slate-500">{publicUsername(item)}</span>}
                    </span>
                    <span className="text-xs font-black uppercase text-sky-700">Allow</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 grid gap-2">
              {allowedSenders.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-sm font-semibold text-slate-500">No selected senders yet.</p>
              ) : allowedSenders.map((sender) => (
                <div key={sender.id} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{publicUserLabel(sender)}</p>
                    {publicUsername(sender) && <p className="text-xs font-semibold text-slate-500">{publicUsername(sender)}</p>}
                  </div>
                  <button onClick={() => removeAllowedSender(sender.id)} disabled={savingEmailPrefs} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 disabled:opacity-60">
                    <X className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <Settings2 className="h-6 w-6 text-slate-800" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Customize Writing UI</p>
                <h2 className="text-2xl font-black text-slate-950">Make the diary controls yours</h2>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <label className="block rounded-lg border border-slate-200 bg-slate-50 p-4">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                  <Type className="h-4 w-4" />
                  App name
                </span>
                <input
                  value={customize.brand_name}
                  onChange={(event) => setCustomize((current) => ({ ...current, brand_name: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900"
                  placeholder="SilentLines"
                  maxLength={60}
                />
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Shown only for your account.</p>
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-black text-slate-700">
                <Upload className="h-4 w-4" />
                Replace SilentLines Logo
                <input type="file" accept="image/*" className="hidden" onChange={(event) => importLogo(event.target.files?.[0])} />
              </label>
              {customize.logo_image && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <img src={customize.logo_image} alt="Custom logo preview" className="h-20 w-20 rounded-lg object-contain" />
                  <button onClick={() => setCustomize((current) => ({ ...current, logo_image: "" }))} className="mt-3 text-sm font-black text-red-600">Remove custom logo</button>
                </div>
              )}
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={customize.code_mode}
                  onChange={(event) => setCustomize((current) => ({ ...current, code_mode: event.target.checked }))}
                  className="mt-1 h-5 w-5 accent-slate-900"
                />
                <span>
                  Code writing mode
                  <span className="block text-xs font-semibold leading-5 text-slate-500">Use a monospace-friendly diary editor for code blocks and technical notes.</span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={customize.ai_enabled}
                  onChange={(event) => setCustomize((current) => ({ ...current, ai_enabled: event.target.checked }))}
                  className="mt-1 h-5 w-5 accent-slate-900"
                />
                <span>
                  AI buddy
                  <span className="block text-xs font-semibold leading-5 text-slate-500">Let the assistant help inside entries.</span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={customize.ai_blocked}
                  onChange={(event) => setCustomize((current) => ({ ...current, ai_blocked: event.target.checked }))}
                  className="mt-1 h-5 w-5 accent-slate-900"
                />
                <span>
                  Block AI
                  <span className="block text-xs font-semibold leading-5 text-slate-500">Pause AI access for this account.</span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={customize.accessibility_labels}
                  onChange={(event) => setCustomize((current) => ({ ...current, accessibility_labels: event.target.checked }))}
                  className="mt-1 h-5 w-5 accent-slate-900"
                  aria-label="Enable extra screen reader labels for TalkBack and assistive technology"
                />
                <span>
                  Extra TalkBack labels
                  <span className="block text-xs font-semibold leading-5 text-slate-500">Adds clearer labels and visible text beside navigation icons for screen readers and low-vision use.</span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={customize.navigation_assistant}
                  onChange={(event) => setCustomize((current) => ({ ...current, navigation_assistant: event.target.checked }))}
                  className="mt-1 h-5 w-5 accent-slate-900"
                  aria-label="Enable local navigation assistant"
                />
                <span>
                  Navigation assistant
                  <span className="block text-xs font-semibold leading-5 text-slate-500">A low-credit helper that opens after login and navigates by matching your words locally.</span>
                </span>
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                  <Palette className="h-4 w-4" />
                  Effects
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {effectOptions.map((effect) => (
                    <button
                      key={effect.id}
                      type="button"
                      onClick={() => toggleCustomizeList("effects", effect.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                        customize.effects.includes(effect.id)
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {effect.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                  <SmilePlus className="h-4 w-4" />
                  Stickers
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stickerOptions.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => toggleCustomizeList("stickers", sticker.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                        customize.stickers.includes(sticker.id)
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {sticker.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {customize.buttons.map((button, index) => {
                const required = requiredEditorButtons.has(button.id);
                return (
                  <div
                    key={button.id}
                    draggable={!required}
                    onDragStart={() => setDraggingButtonId(button.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleButtonDrop(button.id);
                    }}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex gap-1">
                      <button onClick={() => moveCustomizeButton(button.id, -1)} disabled={index === 0} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40" aria-label={`Move ${button.label} up`}><ArrowUp className="h-4 w-4" /></button>
                      <button onClick={() => moveCustomizeButton(button.id, 1)} disabled={index === customize.buttons.length - 1} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40" aria-label={`Move ${button.label} down`}><ArrowDown className="h-4 w-4" /></button>
                    </div>
                    <div>
                      <p className="flex items-center gap-2 text-sm font-black text-slate-950">
                        {!required && <GripVertical className="h-4 w-4 text-slate-400" />}
                        {button.label}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">{required ? "Required. Cannot be removed." : "Optional. Hide from your writing UI."}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-600">
                      <input
                        type="checkbox"
                        checked={button.visible}
                        disabled={required}
                        onChange={(event) => updateCustomizeButton(button.id, { visible: event.target.checked })}
                        className="h-5 w-5 accent-slate-900 disabled:opacity-50"
                      />
                      Show
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-100 p-6 sm:grid-cols-2">
            <button onClick={() => saveCustomize()} disabled={savingCustomize} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-60">
              {savingCustomize ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Customize
            </button>
            <button onClick={resetCustomize} disabled={savingCustomize} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-800 disabled:opacity-60">
              <RefreshCcw className="h-4 w-4" />
              Reset Customize
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="bg-[#3b261b] p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-amber-200">Diary Lock</p>
                <h2 className="text-2xl font-black">Ask for a password before opening private writing</h2>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-950">
              <input
                type="checkbox"
                checked={lock.is_enabled}
                onChange={(event) => setLock((current) => ({ ...current, is_enabled: event.target.checked }))}
                className="mt-1 h-5 w-5 accent-amber-700"
                aria-label="Enable diary password lock"
              />
              <span>
                Enable diary lock
                <span className="mt-1 block text-xs font-semibold leading-5 text-amber-800">A password will be required based on the timing you choose.</span>
              </span>
            </label>

            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Ask for password
              <select
                value={lock.prompt_frequency}
                onChange={(event) => setLock((current) => ({ ...current, prompt_frequency: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                aria-label="Diary lock password timing"
              >
                <option value="every_visit">Every time website opens</option>
                <option value="daily">Once in a day</option>
                <option value="entry_open">Whenever a written diary entry opens</option>
              </select>
            </label>

            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Password
              <input
                type="password"
                value={lock.password}
                onChange={(event) => setLock((current) => ({ ...current, password: event.target.value }))}
                placeholder={lock.is_enabled ? "Leave blank to keep current password" : "Create a diary password"}
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                aria-label="Set diary lock password"
              />
              <button
                type="button"
                onClick={sendNewLockPassword}
                disabled={resettingLock}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-black normal-case tracking-normal text-amber-800 hover:text-amber-950 disabled:opacity-60"
                aria-label="Send a new diary password to my registered email"
              >
                {resettingLock ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Forgot password?
              </button>
              <span className="block text-xs font-semibold leading-5 text-slate-500 normal-case tracking-normal">
                You can receive a new diary password up to 3 times per month.
              </span>
            </label>

            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Recovery Hint
              <input
                value={lock.recovery_hint}
                onChange={(event) => setLock((current) => ({ ...current, recovery_hint: event.target.value }))}
                placeholder="Example: the place I wrote my first diary"
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                aria-label="Diary lock recovery hint"
              />
            </label>

            <button onClick={saveLock} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 text-sm font-black text-white md:col-span-2" aria-label="Save diary lock settings">
              <KeyRound className="h-4 w-4" />
              Save Diary Lock
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function clearLockUnlocks(email) {
  if (!email) return;
  [sessionStorage, localStorage].forEach((storage) => {
    ["every_visit", "daily", "entry_open"].forEach((frequency) => {
      storage.removeItem(`silentlines_diary_unlocked:${email}:${frequency}`);
    });
  });
}

function ModeCard({ active, onClick, icon: Icon, title, text }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left shadow-sm transition ${
        active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <Icon className={`mb-4 h-6 w-6 ${active ? "text-emerald-700" : "text-slate-500"}`} />
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{text}</p>
    </button>
  );
}

function SettingsLink({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50">
      <Icon className="h-4 w-4 text-slate-500" />
      <span>{label}</span>
    </Link>
  );
}
