import React from "react";
import { Lock, ShieldCheck, UserCheck, AlertTriangle } from "lucide-react";
import { Helmet } from "react-helmet-async";
import Footer from "../component/Footer";
export default function PrivacyPolicy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy – SilentLines</title>
        <meta
          name="description"
          content="Learn how SilentLines protects your personal data, diary entries, and emotional privacy."
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-rose-50 to-amber-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto mt-10">
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col min-h-[80vh] border-l-[15px] border-l-stone-300 border border-stone-200">

            {/* Header */}
            <div className="p-6 border-b border-stone-200 flex items-center gap-3 bg-stone-50/50">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h1 className="text-xl font-bold uppercase tracking-tighter text-stone-800">
                Privacy Policy
              </h1>
            </div>

            {/* Body */}
            <div
              className="relative flex-grow bg-white"
              style={{
                backgroundImage: "linear-gradient(#e5e7eb 1px, transparent 1px)",
                backgroundSize: "100% 2.5rem",
              }}
            >
              <div className="absolute left-12 top-0 bottom-0 w-px bg-red-200" />

              <div
                className="p-12 pl-16 text-gray-800 text-2xl leading-[2.5rem]"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                <p className="mb-8">
                  At <strong>SilentLines</strong>, your privacy is not a feature —
                  it is our foundation.
                </p>

                <div className="space-y-10">
                  <div className="flex gap-4">
                    <UserCheck className="w-7 h-7 text-blue-500 mt-1" />
                    <p>
                      <strong>Information We Collect:</strong>  
                      We store essential details such as your email address,
                      username, IP address, and authentication identifiers.
                      This data is collected strictly for account security,
                      abuse prevention, and system integrity.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Lock className="w-7 h-7 text-purple-500 mt-1" />
                    <p>
                      <strong>Encrypted Diaries:</strong>  
                      All diary entries are encrypted before storage.  
                      Only you — and collaborators explicitly added by you —
                      can decrypt and view shared entries.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <ShieldCheck className="w-7 h-7 text-green-600 mt-1" />
                    <p>
                      <strong>Data Usage:</strong>  
                      We do not read, sell, analyze, or monetize your diary
                      content. Your emotions remain yours alone.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <AlertTriangle className="w-7 h-7 text-red-500 mt-1" />
                    <p>
                      <strong>Security Monitoring:</strong>  
                      Any attempt to exploit, attack, scrape, or compromise
                      the platform is actively monitored and may result in
                      permanent account suspension and legal action.
                    </p>
                  </div>
                </div>

                <p className="mt-12 italic text-stone-500">
                  SilentLines exists to protect emotional expression — not to
                  exploit it.
                </p>

                <div className="mt-10 text-sm font-sans text-stone-400 border-t border-dashed pt-4">
                  Last updated: December 2025
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
