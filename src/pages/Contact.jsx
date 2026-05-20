import React from "react";
import { LifeBuoy, Mail, MessageSquare } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function Contact() {
  return (
    <>
      <Helmet>
        <title>Support - SilentLines Trader</title>
        <meta name="description" content="Get support for wallet tracking, trade journaling, and AI coaching." />
      </Helmet>
      <main className="min-h-screen bg-[#f4f7f4] px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <LifeBuoy className="h-7 w-7 text-emerald-700" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Support Desk</p>
                <h1 className="text-3xl font-black text-stone-950">Need help with your trade journal?</h1>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-stone-50 p-4">
                <Mail className="mb-3 h-5 w-5 text-emerald-700" />
                <h2 className="font-black text-stone-900">Email</h2>
                <p className="mt-2 text-sm font-semibold text-stone-600">SilentLines@snapcourse.in</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-4">
                <MessageSquare className="mb-3 h-5 w-5 text-emerald-700" />
                <h2 className="font-black text-stone-900">What to include</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                  Page, wallet address if relevant, exact error, and whether you were saving a journal or fetching data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
