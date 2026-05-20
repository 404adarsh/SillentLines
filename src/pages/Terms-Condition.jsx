import React from "react";
import { FileText, Gavel, ShieldAlert } from "lucide-react";
import { Helmet } from "react-helmet-async";
import Footer from "../component/Footer";

export default function TermsConditions() {
  return (
    <>
      <Helmet>
        <title>Terms & Conditions – SilentLines</title>
        <meta
          name="description"
          content="Terms governing the use of SilentLines diary platform."
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto mt-10">
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col min-h-[80vh] border-l-[15px] border-l-slate-300 border border-slate-200">

            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center gap-3 bg-slate-50/50">
              <FileText className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold uppercase tracking-tighter text-slate-800">
                Terms & Conditions
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
                className="p-12 pl-16 text-slate-800 text-2xl leading-[2.5rem]"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                <p className="mb-8">
                  By accessing or using <strong>SilentLines</strong>, you agree
                  to the following terms.
                </p>

                <div className="space-y-10">
                  <div className="flex gap-4">
                    <Gavel className="w-7 h-7 text-amber-600 mt-1" />
                    <p>
                      <strong>Acceptable Use:</strong>  
                      You agree not to misuse the platform, attempt
                      unauthorized access, reverse engineering, scraping,
                      or any form of cyber attack.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <ShieldAlert className="w-7 h-7 text-red-600 mt-1" />
                    <p>
                      <strong>Zero Tolerance for Abuse:</strong>  
                      Any attempt to exploit vulnerabilities, bypass security,
                      or harm the platform or its users will result in immediate
                      termination and possible legal action under applicable
                      cyber laws.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <FileText className="w-7 h-7 text-blue-500 mt-1" />
                    <p>
                      <strong>Content Responsibility:</strong>  
                      You retain full ownership of your diary content. You are
                      solely responsible for what you write and share.
                    </p>
                  </div>
                </div>

                <p className="mt-12 italic text-slate-500">
                  SilentLines is a private emotional space — respect it.
                </p>

                <div className="mt-10 text-sm font-sans text-slate-400 border-t border-dashed pt-4">
                  Last updated: December 2025
                </div>
              </div>
            </div>
          </div>
        </div>
        Footer
      </div>
    </>
  );
}
