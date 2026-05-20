import { Loader2 } from "lucide-react";

export default function AuthLoading({ message = "Opening your diary..." }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] px-4 text-slate-800">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-amber-200 bg-white/90 p-6 text-center shadow-xl">
        <Loader2 className="h-9 w-9 animate-spin text-amber-700" />
        <p className="text-sm font-bold">{message}</p>
        <p className="text-xs font-semibold leading-5 text-slate-500">
          Restoring your secure session.
        </p>
      </div>
    </main>
  );
}
