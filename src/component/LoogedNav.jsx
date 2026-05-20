import React, { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  LogOut,
  LockKeyhole,
  Menu,
  X,
  User,
  Bell,
  Contact,
  Home,
  Settings2,
  Archive,
  Bot,
  CalendarDays,
  Calculator,
  FileCode2,
  File,
  LineChart,
  Send,
  Shield,
  SunMedium,
  UsersRound,
} from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import Redirectuser from "./Redirectuser";
import logo from "../img/logo.png";
import { defaultWorkspacePrefs, normalizePrefs } from "./WorkspaceSettings";
import { apiUrl } from "../lib/api";
import { defaultEditorCustomize, menuShortcutOptions, normalizeEditorCustomize } from "../lib/writingCustomize";
import ProductLauncher from "./ProductLauncher";

export default function LoggedNavbar() {
  const { isAuthenticated, user, isLoading, logout } = useAuth0();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [writingCustomize, setWritingCustomize] = useState(defaultEditorCustomize);
  const [prefs, setPrefs] = useState(() => {
    try {
      return normalizePrefs(JSON.parse(localStorage.getItem("silentlines_prefs") || "{}"));
    } catch {
      return defaultWorkspacePrefs;
    }
  });
  const notifRef = useRef(null); // To detect clicks outside
  const menuItems = buildMenuItems(prefs, writingCustomize);

  const closeMenu = () => setOpen(false);
  const handleLogout = () => {
    setLoggingOut(true);
    setTimeout(() => logout({ logoutParams: { returnTo: window.location.origin } }), 450);
  };

  // 1. Fetch Notifications
  const checkNotifs = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(apiUrl("/get_notifications.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email })
      });
      const data = await readJson(res);
      if (data.status === 'success') setNotifications(data.notifications);
    } catch (err) { console.error("Fetch error:", err); }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkNotifs();
      const interval = setInterval(checkNotifs, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user?.email]);

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
    let cancelled = false;
    fetch(`${apiUrl("/writing_customization.php")}?email=${encodeURIComponent(user.email)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.status === "success") setWritingCustomize(normalizeEditorCustomize(data.customization));
      })
      .catch(() => {});

    const sync = (event) => {
      if (event.detail?.customization) setWritingCustomize(normalizeEditorCustomize(event.detail.customization));
    };
    window.addEventListener("silentlines-writing-customized", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("silentlines-writing-customized", sync);
    };
  }, [isAuthenticated, user?.email]);
  useEffect(() => {
    const syncPrefs = () => {
      try {
        setPrefs(normalizePrefs(JSON.parse(localStorage.getItem("silentlines_prefs") || "{}")));
      } catch {
        setPrefs(defaultWorkspacePrefs);
      }
    };
    window.addEventListener("silentlines-prefs-updated", syncPrefs);
    return () => window.removeEventListener("silentlines-prefs-updated", syncPrefs);
  }, []);
  const handleInvitation = async (entryId, action, notifId) => {
    try {
      const res = await fetch(apiUrl("/respond_invitation.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: entryId,
          user_email: user.email,
          action: action
        }),
      });

      const data = await readJson(res);
      if (data.status === "success") {
        // Remove the notification from the UI locally
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        alert(`Invitation ${action}ed!`);
        if (action === 'accept') {
          window.dispatchEvent(new Event("diary-added"));
          navigate("/notes");
        }
      }

    } catch (err) {
      console.error("Response error:", err);
    }
  };
  // 2. Mark as Read Function
  const markAsRead = async (notifId, entryId) => {
    try {
      await fetch(apiUrl("/mark_read.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notifId })
      });
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      if (entryId) navigate(`/edit/${entryId}`);
    } catch (err) { console.error(err); }
  };

  // 3. Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading || !isAuthenticated) return null;

  return (
    <>
      <Redirectuser />

      <nav className="sticky top-0 z-50 border-b border-rose-100 bg-[#fffaf5]/95 text-stone-900 shadow-[0_10px_30px_rgba(120,53,15,0.08)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">

          <Link to="/" onClick={closeMenu} className="flex min-w-0 items-center gap-2 font-serif text-lg font-bold text-stone-950 sm:text-xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-100 bg-white shadow-sm">
              <img src={writingCustomize.logo_image || logo} className="h-8 w-8 object-contain" alt="Logo" />
            </span>
            <span className="truncate">{writingCustomize.brand_name || "SilentLines"}</span>
          </Link>

          <div className="hidden lg:flex items-center gap-2 rounded-full border border-rose-100 bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-widest text-rose-700 shadow-sm">
            Personalized workspace
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-3 md:gap-4">
            <ProductLauncher />

            {/* NOTIFICATION SECTION */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="relative rounded-lg border border-transparent p-2 text-stone-600 transition hover:border-rose-100 hover:bg-white"
                aria-label={showNotifPanel ? "Hide notifications" : "Show notifications"}
                title="Notifications"
              >
                <Bell className={`h-5 w-5 ${showNotifPanel ? 'text-rose-700' : 'text-stone-600'}`} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* DROPDOWN PANEL */}
              {showNotifPanel && (
                <div className="fixed left-1/2 top-20 z-[2300] w-[90vw] max-w-sm -translate-x-1/2 rounded-lg border border-rose-100 bg-[#fffaf5] shadow-2xl">
                  <div className="border-b border-rose-100 p-3 text-sm font-black text-stone-900">
                    Notifications
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((n) => {
                        const isInvite = n.message.includes("invited you");
                        return (
                        <div
                          key={n.id}
                            className="border-b border-rose-50 p-3 hover:bg-white"
                        >
                          <p
                            className={`text-sm ${isInvite ? "" : "cursor-pointer"}`}
                            onClick={() => {
                              if (!isInvite) markAsRead(n.id, n.entry_id);
                            }}
                          >
                            <strong>{n.sender_username}</strong>{" "}
                            {n.message}
                          </p>

                          {isInvite && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() =>
                                  handleInvitation(
                                    n.entry_id,
                                    "accept",
                                    n.id
                                  )
                                }
                                className="text-xs bg-orange-500 text-white px-3 py-1 rounded"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() =>
                                  handleInvitation(
                                    n.entry_id,
                                    "reject",
                                    n.id
                                  )
                                }
                                className="text-xs bg-gray-200 px-3 py-1 rounded"
                              >
                                Ignore
                              </button>
                            </div>
                          )}
                        </div>
                      );
                      })
                    ) : (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        No new notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/profile" className="hidden items-center gap-3 rounded-lg border border-transparent py-1 pl-1 pr-2 transition-all duration-300 hover:border-rose-100 hover:bg-white sm:flex">
              <img src={user.picture} alt="Profile" className="h-9 w-9 rounded-lg border-2 border-white object-cover shadow-sm ring-1 ring-rose-100" referrerPolicy="no-referrer" />
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-none text-stone-800">{user.given_name || user.nickname}</span>
                <span className="text-[10px] font-medium text-stone-500">Profile</span>
              </div>
            </Link>

            <button onClick={() => navigate("/settings")} className="hidden rounded-lg border border-transparent p-2 text-stone-600 transition hover:border-rose-100 hover:bg-white md:block" aria-label="Open settings" title="Settings">
              <Settings2 className="h-5 w-5" />
              {writingCustomize.accessibility_labels && <span className="sr-only">Open settings page</span>}
            </button>

            <button onClick={() => setOpen(true)} className="rounded-lg border border-transparent p-2 transition hover:border-rose-100 hover:bg-white" aria-label="Open menu">
              <Menu className="h-6 w-6 text-stone-700" />
            </button>

            <button onClick={handleLogout} className="hidden min-h-10 items-center gap-2 rounded-lg border border-rose-100 bg-white/60 px-3 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-50 hover:text-red-700 md:flex" aria-label="Logout">
              {loggingOut ? <LockKeyhole className="h-4 w-4 animate-bounce" /> : <LogOut className="h-4 w-4" />}
              <span>{loggingOut ? "Locking" : "Logout"}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      <div className={`fixed inset-0 z-1000 transition ${open ? "visible" : "invisible"}`}>
        <div onClick={closeMenu} className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute right-0 top-0 h-full w-[min(20rem,88vw)] transform overflow-y-auto bg-[#fffaf5] shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-rose-100 bg-white/65 px-5 py-4">
            <span className="font-serif text-lg font-bold text-stone-900">Menu</span>
            <button onClick={closeMenu} className="rounded-lg p-2 text-stone-600 transition hover:bg-rose-50" aria-label="Close menu" title="Close menu"><X className="h-6 w-6" /></button>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {menuItems.length === 0 ? (
              <p className="rounded-lg border border-rose-100 bg-white p-4 text-sm font-semibold text-stone-500">
                No shortcuts selected. Open Settings to add pages back to this menu.
              </p>
            ) : menuItems.map((item) => (
              <MobileLink key={item.id} to={item.path} onClick={closeMenu} label={item.label}>
                <item.icon aria-hidden="true" /> <span className="ml-3">{item.label}</span>
              </MobileLink>
            ))}
            <button onClick={handleLogout} className={`${mobileBtn} mt-4 bg-red-50 text-red-600`} aria-label="Logout">
              {loggingOut ? <LockKeyhole className="animate-bounce" /> : <LogOut />}
              <span className="ml-3">{loggingOut ? "Locking diary" : "Logout"}</span>
            </button>
          </div>
        </aside>
      </div>
      {writingCustomize.navigation_assistant && <NavigationAssistant />}
    </>
  );
}

const mobileBtn = "flex items-center rounded-lg px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-white";

function MobileLink({ to, children, onClick, label }) {
  return (
    <NavLink to={to} onClick={onClick} className={mobileBtn} aria-label={label ? `Open ${label}` : undefined}>
      {children}
    </NavLink>
  );
}

const iconByShortcut = {
  home: Home,
  profile: User,
  write: BookOpen,
  notes: BookOpen,
  archive: Archive,
  daily: SunMedium,
  people: UsersRound,
  trade: LineChart,
  portfolio: LineChart,
  accounts: Calculator,
  programming: FileCode2,
  calendar: CalendarDays,
  tutorial: BookOpen,
  safety: Shield,
  contact: Contact,
  tools: File,
  settings: Settings2,
};

function buildMenuItems(prefs, customize) {
  const selected = Array.isArray(customize.menu_shortcuts) ? customize.menu_shortcuts : [];
  return menuShortcutOptions
    .filter((item) => selected.includes(item.id))
    .filter((item) => {
      if (["trade", "portfolio"].includes(item.id)) return prefs.use_trading;
      if (item.id === "accounts") return prefs.use_accounting || prefs.use_commerce;
      if (item.id === "programming") return prefs.use_programming;
      if (["write", "notes", "archive", "calendar"].includes(item.id)) return prefs.use_personal;
      return true;
    })
    .map((item) => ({ ...item, icon: iconByShortcut[item.id] || BookOpen }));
}

function NavigationAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => sessionStorage.getItem("silentlines_nav_assistant_seen") !== "1");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("Tell me where you want to go, like saved notes, people memory, settings, write diary, portfolio, or support.");

  useEffect(() => {
    if (open) sessionStorage.setItem("silentlines_nav_assistant_seen", "1");
  }, [open]);

  const go = () => {
    const route = findNavigationRoute(query);
    if (!route) {
      setAnswer("I could not match that page yet. Try words like notes, write diary, people, settings, profile, archive, trade, accounts, programming, safety, or support.");
      return;
    }
    setAnswer(`Opening ${route.label}.`);
    setOpen(false);
    navigate(route.path);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[2200]">
      {open ? (
        <div className="w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-rose-100 bg-white p-4 shadow-2xl" role="dialog" aria-modal="false" aria-labelledby="nav-assistant-title">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-rose-700" aria-hidden="true" />
              <h2 id="nav-assistant-title" className="text-sm font-black text-stone-950">Navigation assistant</h2>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-stone-500 hover:bg-stone-100" aria-label="Close navigation assistant">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-stone-600" aria-live="polite">{answer}</p>
          <div className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") go();
              }}
              placeholder="Where do you want to go?"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 text-sm font-bold outline-none focus:border-rose-300"
              aria-label="Tell navigation assistant which page to open"
            />
            <button onClick={go} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-stone-950 text-white" aria-label="Navigate to requested page">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-black text-white shadow-2xl" aria-label="Open navigation assistant">
          <Bot className="h-4 w-4" aria-hidden="true" />
          Navigate
        </button>
      )}
    </div>
  );
}

function findNavigationRoute(input) {
  const text = String(input || "").toLowerCase();
  const routes = [
    { label: "People Memory", path: "/people", terms: ["people", "person", "memory", "relationship"] },
    { label: "Saved Notes", path: "/notes", terms: ["notes", "saved", "entries", "diary list", "old diary"] },
    { label: "Write Diary", path: "/moodselect", terms: ["write", "new diary", "mood", "diary", "journal"] },
    { label: "Archive", path: "/archive", terms: ["archive", "archived"] },
    { label: "Daily Workspace", path: "/daily-workspace", terms: ["daily", "workspace", "today", "plan"] },
    { label: "Settings", path: "/settings", terms: ["settings", "customize", "preference", "shortcut", "accessibility", "talkback"] },
    { label: "Profile", path: "/profile", terms: ["profile", "account", "username"] },
    { label: "Trade Journal", path: "/trade-journal", terms: ["trade journal", "trading journal", "trade"] },
    { label: "Portfolio", path: "/dashboard", terms: ["portfolio", "dashboard", "wallet"] },
    { label: "Accounts Journal", path: "/accounts-journal", terms: ["accounts", "accounting", "voucher", "tally"] },
    { label: "Programming Journal", path: "/programming-journal", terms: ["programming", "code", "debug"] },
    { label: "Mood Calendar", path: "/calendar", terms: ["calendar", "mood calendar"] },
    { label: "Safety", path: "/safety", terms: ["safety", "privacy", "safe"] },
    { label: "Tutorial", path: "/about", terms: ["tutorial", "about", "help"] },
    { label: "Support", path: "/contact", terms: ["support", "contact", "help desk"] },
    { label: "Home", path: "/", terms: ["home", "start"] },
  ];
  return routes.find((route) => route.terms.some((term) => text.includes(term))) || null;
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
