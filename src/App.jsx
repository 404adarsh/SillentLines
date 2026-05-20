import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Helmet } from "react-helmet-async";

import Home from "./pages/Home";
import Login from "./pages/Login";
import About from "./pages/About";
import Safety from "./pages/Safety";
import Notes from "./pages/Notes";
import Archive from "./pages/Archive";
import SharedEntry from "./pages/SharedEntry";
import MoodSelectionPage from "./pages/Mood";

import Navbar from "./component/Navbar";
import LoggedNav from "./component/LoogedNav";
import ProtectedRoute from "./component/ProtectedRoute";
import PublicRoute from "./component/PublicRoute";
import EnsureUserGate from "./component/EnsureUserGate";
import EditNote from "./pages/EditNote";
import Profile from "./pages/Profile";
import MoodCalendar from "./pages/MoodCalendar";
import DiarySplash from "./component/DiarySplash";
import TermsConditions from "./pages/Terms-Condition";
import PrivacyPolicy from "./pages/Privicy-Policy";
import Contact from "./pages/Contact";
import TraderDashboard from "./pages/TraderDashboard";
import TradeJournal from "./pages/TradeJournal";
import AccountingJournal from "./pages/AccountingJournal";
import SettingsPage from "./pages/Settings";
import PeopleJournal from "./pages/PeopleJournal";
import ProgrammingJournal from "./pages/ProgrammingJournal";
import DailyWorkspace from "./pages/DailyWorkspace";
import FileTools from "./pages/FileTools";
import ThemeStudio from "./component/ThemeStudio";
import AuthLoading from "./component/AuthLoading";

const App = () => {
  const { isAuthenticated, isLoading } = useAuth0();
  const [showSplash, setShowSplash] = useState(true);
  const isSharePath = window.location.pathname.startsWith("/share/");

  if (isLoading && !isSharePath) {
    return <AuthLoading />;
  }

  if (showSplash && !isLoading && !isSharePath) {
    return <DiarySplash isAuthenticated={isAuthenticated} onDone={() => setShowSplash(false)} />;
  }


  return (
    <>
      <Router>
        <AppChrome isAuthenticated={isAuthenticated} isLoading={isLoading} />
        <RouteSeo />
        {/* 🔝 GLOBAL NAV */}

        <Routes>
          {/* 🌍 PUBLIC (redirect if logged in) */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <Home />
              </PublicRoute>
            }
          />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          {/* 🌍 ALWAYS PUBLIC */}
          <Route path="/about" element={<About />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/privacypolicy" element={<PrivacyPolicy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/share/:token" element={<SharedEntry />} />
          <Route path="/tools" element={<FileTools />} />

          <Route path="/termscondition" element={<TermsConditions />} />
          {/* 🔒 AUTH + DB VERIFIED */}
          <Route
            path="/moodselect"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <MoodSelectionPage />
                  <Notes />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <Notes />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/archive"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <Archive />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"  // Changed from /notes/:id to /edit/:id to match Navbar logic
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <EditNote />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <TraderDashboard />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trade-journal"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <TradeJournal />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trade_journal"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <TradeJournal />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts-journal"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <AccountingJournal />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <SettingsPage />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/people"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <PeopleJournal />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/programming-journal"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <ProgrammingJournal />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-workspace"
            element={
              <ProtectedRoute>
                <EnsureUserGate>
                  <DailyWorkspace />
                </EnsureUserGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <MoodCalendar />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<RouteFallback />} />
        </Routes>
      </Router>
    </>
  );
};

export default App;

function AppChrome({ isAuthenticated, isLoading }) {
  const { pathname } = useLocation();
  if (pathname.startsWith("/share/")) return null;
  return (
    <>
      <ThemeStudio />
      {!isLoading && (isAuthenticated ? <LoggedNav /> : <Navbar />)}
    </>
  );
}

function RouteFallback() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/share/")) {
    return <SharedEntry />;
  }
  return null;
}

function RouteSeo() {
  const { pathname } = useLocation();
  const meta = seoByPath(pathname);
  const publicBase = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/$/, "");
  const canonical = `${publicBase}${pathname === "/" ? "/" : pathname}`;
  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="keywords" content={meta.keywords} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
    </Helmet>
  );
}

function seoByPath(pathname) {
  if (pathname.startsWith("/edit")) {
    return {
      title: "Edit Diary Entry | SilentLines AI Diary",
      description: "Edit a private diary entry with AI suggestions, mood music, themes, commit history, and collaborator-safe writing tools.",
      keywords: "edit diary, AI diary, private journal, diary commit history, mood music",
    };
  }
  if (pathname.startsWith("/share")) {
    return {
      title: "Shared Diary Entry | SilentLines",
      description: "Read a diary entry shared with you through SilentLines.",
      keywords: "shared diary entry, SilentLines share, public journal link",
    };
  }

  const map = {
    "/notes": ["My Diary Notes | SilentLines", "Review saved diary entries, weekly AI summaries, monthly insights, moods, collaborators, and saved suggestions.", "saved diary notes, AI diary summary, monthly journal review"],
    "/archive": ["Diary Archive | SilentLines", "Review diary entries you moved into your archive and restore them whenever you need.", "diary archive, archived notes, private journal archive"],
    "/moodselect": ["Write A Diary Entry | SilentLines", "Choose your mood and write a private diary entry with AI help, custom themes, and relaxing music.", "write diary, mood journal, AI writing companion"],
    "/daily-workspace": ["Daily Workspace | SilentLines", "Plan your day, reflect on moods, write intentions, and get AI support in one calm daily workspace.", "daily workspace, daily journal, AI reflection"],
    "/people": ["People Memory Journal | SilentLines", "Capture memories, conversations, and emotional notes about people who matter to you.", "people journal, relationship diary, memory journal"],
    "/programming-journal": ["Programming Journal | SilentLines", "Save code notes, debugging logs, snippets, lessons, and AI-assisted programming reflections.", "programming journal, code diary, debugging notes"],
    "/trade-journal": ["Trade Journal | SilentLines", "Track trading plans, entries, exits, lessons, and AI-supported review notes.", "trade journal, trading diary, trade notes"],
    "/accounts-journal": ["Accounts Journal | SilentLines", "Track business, commerce, budget, and accounting notes in a private journaling workspace.", "accounting journal, business notes, commerce diary"],
    "/settings": ["Settings | SilentLines", "Customize your SilentLines diary workspace, themes, fonts, preferences, and writing experience.", "diary settings, customize journal, theme diary"],
    "/profile": ["Profile | SilentLines", "Manage your SilentLines profile and personal journaling workspace.", "diary profile, private journal profile"],
  };
  const found = map[pathname];
  if (found) return { title: found[0], description: found[1], keywords: found[2] };

  return {
    title: "SilentLines - Private AI Diary, Journal, Mood Music & Themes",
    description: "SilentLines is a private AI diary for daily writing, mood tracking, custom themes, music, summaries, and collaborative diary history.",
    keywords: "private diary, AI diary, online journal, mood tracker, diary music, custom diary themes",
  };
}
