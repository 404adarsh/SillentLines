import React from "react";
import { ArrowRight, BarChart3, BookOpenCheck, Brain, FileCode2, ShieldCheck, SunMedium, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "../component/Footer";
import Logo from "../img/logo.png";
import { Helmet } from "react-helmet-async";

export default function HomePage() {
  const navigate = useNavigate();

  const features = [
    ["Daily Journal", "Capture your thoughts, memories, and mood in a calm, private space.", BookOpenCheck],
    ["Daily Workspace", "Return each day for mood, focus, a tiny intention, and AI reflection.", SunMedium],
    ["Trade Journal", "Write trade plans, risk rules, entries, exits, and lessons learned.", Wallet],
    ["Programming Journal", "Save code notes, snippets, bug hunts, and sandboxed HTML/CSS/JS previews.", FileCode2],
    ["Commerce Notes", "Track business ideas, budget moves, and cash-flow decisions.", BarChart3],
    ["AI Review", "Use smart prompts to reflect, improve your habits, and stay consistent.", Brain],
  ];

  return (
    <>
      <Helmet>
        <title>SilentLines - Journal, Trading Journal & Commerce Notes</title>
        <meta name="description" content="SilentLines is a flexible journaling app for daily diary entries, trading plans, commerce notes, and progress review with AI support." />
      </Helmet>

      <main className="min-h-screen bg-[#f4f7f4]">
        <section className="diary-enter border-b border-emerald-900/10 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:py-12 md:grid-cols-[1fr_0.9fr] md:items-center md:py-14">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-800">
                <img src={Logo} className="h-5 w-5" alt="" />
                Journal | Trading | Commerce
              </div>
              <h1 className="text-3xl font-black leading-tight text-stone-950 sm:text-4xl md:text-6xl">
                Journal life, trades, and business ideas with clarity.
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-stone-600 sm:text-lg sm:leading-8">
                SilentLines is a modern journaling workspace for daily diary entries, trade planning, and commerce thinking.
                Capture personal stories, business ideas, and trading lessons in one calm, focused place.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  "Daily diary entries",
                  "Trading journal plans",
                  "Commerce and business notes",
                ].map((item) => (
                  <div key={item} className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:mt-10 sm:p-6">
                <h2 className="text-lg font-black text-emerald-900">A journal for every perspective</h2>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  SilentLines is not just a trading tool. It's a writing space for daily emotions, business decisions, project planning, and trading insight.
                  Bring your personal story, commerce work, and financial notes together in one beautiful app.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => navigate("/login")} className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-black text-white">
                  Start journaling
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => navigate("/about")} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm font-black text-stone-800">
                  Learn how it works
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-950 p-5 text-white shadow-xl">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Today&apos;s Workspace</p>
                  <h2 className="mt-1 text-2xl font-black">Journal Snapshot</h2>
                </div>
                <BarChart3 className="h-8 w-8 text-emerald-300" />
              </div>
              <div className="grid gap-3">
                <Panel label="Intent" value="Record what matters: emotions, risks, and decisions." />
                <Panel label="Focus" value="Keep insights clear for normal journal, trade notes, and commerce strategy." />
                <Panel label="Review" value="Look back on progress so every idea grows over time." />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {features.map(([title, text, Icon]) => (
              <div key={title} className="diary-card-enter diary-retention-card rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <Icon className="mb-4 h-6 w-6 text-emerald-700" />
                <h3 className="text-lg font-black text-stone-900">{title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-stone-600">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-emerald-700" />
              <p className="text-sm font-semibold leading-6 text-emerald-900">
                Wallet connection stores only public addresses. Private keys are never requested. Demo ideas are
                educational and based on free historical market data, not financial advice.
              </p>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    </>
  );
}

function Panel({ label, value }) {
  return (
    <div className="rounded-lg bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-300">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-100">{value}</p>
    </div>
  );
}
