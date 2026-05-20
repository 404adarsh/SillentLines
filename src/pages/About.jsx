import React from "react";
import { BarChart3, BookOpenCheck, Brain, BriefcaseBusiness, Wallet } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function About() {
  const tools = [
    ["Trade Journal", "Plan entries, exits, thesis, risk, and review notes before and after trades.", BookOpenCheck],
    ["Wallet Tracker", "Connect a public wallet address and inspect token balances and wallet activity.", Wallet],
    ["Demo Ideas", "Use free past market data to create paper-trade ideas for learning.", BarChart3],
    ["Sarvam Coach", "Get trading progress, mistakes, discipline notes, and next-action feedback.", Brain],
    ["Commerce Tools", "Journal capital, break-even logic, cash-flow assumptions, and business decisions.", BriefcaseBusiness],
  ];

  return (
    <>
      <Helmet>
        <title>About SilentLines Trader</title>
        <meta name="description" content="SilentLines Trader is a trade journal, wallet tracker, demo trade desk, and AI coach." />
      </Helmet>
      <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-50 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="border-b border-emerald-900/10 pb-8">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">About The Platform</p>
            <h1 className="mt-3 text-4xl font-black text-stone-950">A trading desk for decisions, not guesses.</h1>
            <p className="mt-4 max-w-3xl text-lg font-medium leading-8 text-stone-600">
              SilentLines still protects personal writing, but the main experience is now built around market
              discipline: plan, paper trade, track, review, and improve.
            </p>
          </div>
          <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools.map(([title, text, Icon]) => (
              <div key={title} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <Icon className="mb-4 h-6 w-6 text-emerald-700" />
                <h2 className="text-xl font-black text-stone-900">{title}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-stone-600">{text}</p>
              </div>
            ))}
          </section>
          <section className="mt-8 rounded-xl border border-emerald-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Beginner Tutorial</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">If you know nothing about trading, start here</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <Step n="1" title="Paper trade only" text="Use demo ideas first. Do not risk real money while learning." />
              <Step n="2" title="Write before entry" text="Record asset, reason, risk, entry, target, and invalidation." />
              <Step n="3" title="Review later" text="Come back and compare your plan with what actually happened." />
              <Step n="4" title="Improve process" text="Judge discipline, not only profit. Good process comes first." />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Step({ n, title, text }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">{n}</div>
      <h3 className="font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{text}</p>
    </div>
  );
}
