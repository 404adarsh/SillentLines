import React, { useState } from "react";
import { Info, ShieldCheck, ArrowRight, Menu, X, LifeBuoy, BookOpen, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../img/logo.png"
import ProductLauncher from "./ProductLauncher";

export default function Navbar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
    <nav className="sticky top-0 z-50 border-b border-rose-100 bg-[#fffaf5]/95 text-stone-900 shadow-[0_10px_30px_rgba(120,53,15,0.08)] backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* LOGO */}
          <div
            onClick={() => go("/")}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-white shadow-sm">
              <img src={logo} className="w-8 h-8" alt="SilentLines logo" />
            </div>
            <div>
              <span className="truncate text-lg font-black text-stone-950 sm:text-xl">SilentLines</span>
              <p className="text-xs font-semibold text-stone-500 sm:text-sm">Journal for every plan, memory, and business idea</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={() => go("/")} className="text-sm font-bold text-stone-700 transition hover:text-rose-700">Home</button>
            <button onClick={() => go("/about")} className="text-sm font-bold text-stone-700 transition hover:text-rose-700">What is SilentLines</button>
            <button onClick={() => go("/tools")} className="text-sm font-bold text-stone-700 transition hover:text-rose-700">Tools</button>
            <button onClick={() => go("/contact")} className="text-sm font-bold text-stone-700 transition hover:text-rose-700">Support</button>
            <button onClick={() => go("/safety")} className="text-sm font-bold text-stone-700 transition hover:text-rose-700">Safety</button>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ProductLauncher />
            <button
              onClick={() => go("/login")}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:shadow-lg sm:px-4"
            >
              Start journaling
              <ArrowRight className="hidden h-4 w-4 sm:block" />
            </button>
            <button onClick={() => setOpen(true)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-rose-100 bg-white/75 text-stone-700 transition hover:border-rose-200 hover:bg-white md:hidden" aria-label="Open menu" title="Open menu">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </nav>

      {open && (
      <div className="fixed inset-0 z-[3000] transition-all md:hidden">
        <div
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
        />
        <aside
          className="absolute right-0 top-0 flex h-dvh w-[min(22rem,92vw)] flex-col overflow-hidden bg-[#fffaf5] text-stone-900 shadow-2xl transition-transform duration-300"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="flex items-center justify-between border-b border-rose-100 bg-white/65 px-4 py-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-rose-700">SilentLines</p>
              <p className="text-sm font-semibold text-stone-900">Journal for every story and plan.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-stone-600 transition hover:bg-rose-50"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            <DrawerButton onClick={() => go("/")} icon={Info} label="Home" />
            <DrawerButton onClick={() => go("/about")} icon={BookOpen} label="What is SilentLines" />
            <DrawerButton onClick={() => go("/contact")} icon={LifeBuoy} label="Support" />
            <DrawerButton onClick={() => go("/safety")} icon={ShieldCheck} label="Privacy & Safety" />
            <DrawerButton onClick={() => go("/login")} icon={BarChart3} label="Start your journal" />
          </div>

          <div className="border-t border-rose-100 bg-white/55 px-4 py-4 text-sm text-stone-600">
            <p className="font-semibold text-stone-900">Build any journal</p>
            <p className="mt-2 leading-6">
              Use SilentLines for daily diary entries, trading plans, commerce notes, and creative ideas.
              Everything is designed for thoughtful writing, reviewing, and progress tracking.
            </p>
          </div>
        </aside>
      </div>
      )}
    </>
  );
}

function DrawerButton({ onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className="flex min-h-12 items-center gap-3 rounded-lg bg-white px-4 py-3 text-left text-sm font-bold text-stone-800 shadow-sm transition hover:bg-rose-50 focus:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-100">
      <Icon className="h-5 w-5 shrink-0 text-stone-600" />
      <span>{label}</span>
    </button>
  );
}
