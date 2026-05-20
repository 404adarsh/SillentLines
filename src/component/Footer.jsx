import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="mt-0 border-t border-emerald-400/20 bg-slate-950 py-8 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <p className="mb-2 text-sm">
          © 2026 <span className="font-semibold text-white">SilentLines Trader</span>. All rights reserved.
          <br className="sm:hidden" />
          <span className="text-xs text-slate-400">
            Operated by <span className="font-medium">SnapCourse.in</span>
          </span>
        </p>

        <div className="mt-3 flex justify-center gap-6 text-sm">
          <Link to="/privacypolicy" className="underline-offset-4 transition-colors hover:text-emerald-300 hover:underline">
            Privacy Policy
          </Link>
          <span className="text-slate-600">|</span>
          <Link to="/termscondition" className="underline-offset-4 transition-colors hover:text-emerald-300 hover:underline">
            Terms & Conditions
          </Link>
        </div>

        <p className="mt-4 text-xs italic text-slate-500">
          Practice decisions. Track discipline. Keep private keys private.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
