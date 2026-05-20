import React from "react";
import { AlertTriangle, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function Safety() {
  return (
    <>
      <Helmet>
        <title>Trading Safety - SilentLines Trader</title>
        <meta name="description" content="Wallet, API, and trading safety practices for SilentLines Trader." />
      </Helmet>
      <main className="min-h-screen bg-[#f4f7f4] px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Safety</p>
            <h1 className="mt-3 text-4xl font-black text-stone-950">Trade carefully. Store less. Learn more.</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card icon={Wallet} title="Wallet safety" text="SilentLines stores only your public wallet address. It never asks for seed phrases, private keys, or signing permissions." />
            <Card icon={KeyRound} title="API keys" text="AI and market-data keys belong on the PHP server only, never in React or browser-visible files." />
            <Card icon={AlertTriangle} title="No financial advice" text="Demo trade ideas are for learning from historical data. Always treat them as paper-trade practice." />
            <Card icon={ShieldCheck} title="Journal discipline" text="Write your invalidation level before a trade. If the plan breaks, the journal should make that obvious." />
          </div>
        </div>
      </main>
    </>
  );
}

function Card({ icon: Icon, title, text }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <Icon className="mb-4 h-6 w-6 text-emerald-700" />
      <h2 className="text-xl font-black text-stone-900">{title}</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-stone-600">{text}</p>
    </div>
  );
}
