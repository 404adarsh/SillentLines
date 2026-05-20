import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";

const products = [
  {
    name: "SilentLines",
    label: "Diary",
    href: "/moodselect",
    icon: BookOpen,
    color: "bg-rose-50 text-rose-700 ring-rose-100",
  },
];

export default function ProductLauncher({ align = "right" }) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (launcherRef.current && !launcherRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={launcherRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-rose-100 bg-white/75 text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-white hover:shadow-md"
        aria-label={open ? "Hide Snapcourse products" : "Show Snapcourse products"}
        aria-expanded={open}
        title="Apps"
      >
        <span className="grid h-5 w-5 grid-cols-3 gap-0.5" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className="rounded-full bg-current transition group-hover:scale-110" />
          ))}
        </span>
      </button>

      {open && (
        <div className={`fixed left-2 right-2 top-16 z-[2300] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-lg border border-rose-100 bg-[#fffaf5] p-3 text-stone-900 shadow-2xl sm:absolute sm:left-auto sm:right-auto sm:top-12 sm:w-80 sm:max-h-[min(30rem,calc(100dvh-5rem))] ${align === "left" ? "sm:left-0" : "sm:right-0"}`}>
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-rose-100 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-rose-700">Our Apps</p>
              <p className="text-xs font-semibold text-stone-500">Snapcourse network</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {products.map((product) => (
              <ProductTile key={product.name} product={product} onClick={() => setOpen(false)} />
            ))}
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="min-h-[4.75rem] rounded-lg border border-dashed border-rose-100 bg-white/45 sm:min-h-[5.75rem]" aria-hidden="true" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductTile({ product, onClick }) {
  const Icon = product.icon;
  const commonClass = "flex min-h-[4.75rem] flex-col items-center justify-center rounded-lg border border-white bg-white px-1.5 py-2 text-center shadow-sm transition hover:-translate-y-1 hover:border-rose-100 hover:shadow-md sm:min-h-[5.75rem] sm:px-2 sm:py-3";

  if (product.external) {
    return (
      <a href={product.href} target="_blank" rel="noreferrer" onClick={onClick} className={commonClass}>
        <span className={`mb-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 sm:mb-2 sm:h-10 sm:w-10 ${product.color}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
        <span className="max-w-full break-words text-[10px] font-black leading-tight text-stone-900 sm:text-[11px]">{product.name}</span>
        <span className="mt-0.5 max-w-full break-words text-[9px] font-bold leading-tight text-stone-500 sm:text-[10px]">{product.label}</span>
      </a>
    );
  }

  return (
    <a href={product.href} onClick={onClick} className={commonClass}>
      <span className={`mb-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 sm:mb-2 sm:h-10 sm:w-10 ${product.color}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </span>
      <span className="max-w-full break-words text-[10px] font-black leading-tight text-stone-900 sm:text-[11px]">{product.name}</span>
      <span className="mt-0.5 max-w-full break-words text-[9px] font-bold leading-tight text-stone-500 sm:text-[10px]">{product.label}</span>
    </a>
  );
}
