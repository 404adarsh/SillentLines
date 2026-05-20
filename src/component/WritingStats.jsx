import { Brain, Code2, Lightbulb, Timer } from "lucide-react";

export default function WritingStats({ content }) {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  const hint = getSmartHint(content);

  return (
    <div className="grid gap-2 border-b border-gray-100 bg-white/75 p-3 backdrop-blur sm:grid-cols-3">
      <Stat icon={Brain} label="Words" value={words} />
      <Stat icon={Timer} label="Read" value={`${minutes} min`} />
      <div className="flex min-w-0 items-start gap-2 rounded-lg bg-stone-50 p-3">
        {hint.type === "code" ? <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> : <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Smart hint</p>
          <p className="mt-1 text-xs font-bold leading-5 text-stone-700">{hint.text}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-3">
      <Icon className="h-4 w-4 text-stone-500" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</p>
        <p className="text-sm font-black text-stone-800">{value}</p>
      </div>
    </div>
  );
}

function getSmartHint(content) {
  const text = content.toLowerCase();
  if (/\b(code|bug|error|console|api|react|php|server|database|not working|isn't working|isnt working)\b/.test(text)) {
    return {
      type: "code",
      text: "Write the exact error, last change, and one test you tried. AI can debug much better with that.",
    };
  }
  if (/\b(confused|stuck|don't know|dont know|what should i do)\b/.test(text)) {
    return {
      type: "idea",
      text: "End with one question. The AI companion can turn that into a clear next step.",
    };
  }
  return {
    type: "idea",
    text: "Name what happened, what it made you feel, and what you need next.",
  };
}
