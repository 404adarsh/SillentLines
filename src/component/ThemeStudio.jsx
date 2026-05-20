import React, { useEffect, useState } from "react";
import { ImagePlus, Palette, SlidersHorizontal, X } from "lucide-react";
import { applyTheme, loadTheme, normalizeTheme, saveTheme, themeFontOptions, themePresets } from "../lib/themes";

export default function ThemeStudio() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    applyTheme(theme);
    const sync = () => {
      const next = loadTheme();
      setTheme(next);
      applyTheme(next);
    };
    window.addEventListener("silentlines-theme-updated", sync);
    return () => window.removeEventListener("silentlines-theme-updated", sync);
  }, []);

  const selectPreset = (preset) => {
    const next = normalizeTheme({ ...preset, image: theme.image || "" });
    setTheme(next);
    saveTheme(next);
    applyTheme(next);
  };

  const importImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      shrinkImage(String(reader.result || "")).then((image) => {
        const next = normalizeTheme({ ...theme, image });
        setTheme(next);
        saveTheme(next);
        applyTheme(next);
      });
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    const next = { ...theme, image: "" };
    setTheme(next);
    saveTheme(next);
    applyTheme(next);
  };

  const updateTheme = (patch) => {
    const next = normalizeTheme({ ...theme, ...patch, id: "custom", name: "My Custom Theme" });
    setTheme(next);
    saveTheme(next);
    applyTheme(next);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[var(--sl-page)]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
          style={{ backgroundImage: theme.image ? `url("${theme.image}")` : "none" }}
        />
      </div>

      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-4 z-[80] inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/70 bg-white/90 px-3 text-[var(--sl-accent)] shadow-xl backdrop-blur transition hover:-translate-y-1 sm:bottom-28 sm:left-5 sm:w-11 sm:px-0"
        aria-label="Open theme studio"
        title="Theme studio"
      >
        <Palette className="h-5 w-5" />
        <span className="text-xs font-black uppercase sm:hidden">Theme</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[2200] flex items-stretch justify-center overflow-y-auto bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex min-h-dvh w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:min-h-0 sm:max-h-[92dvh] sm:rounded-lg sm:border sm:border-white/20">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Theme Studio</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Make the diary feel yours</h2>
              </div>
              <button onClick={() => setOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500" aria-label="Close theme studio" title="Close theme studio">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {themePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => selectPreset(preset)}
                  className="rounded-lg border border-slate-200 p-4 text-left transition hover:-translate-y-1 hover:shadow-lg"
                  style={{ background: preset.panel, color: preset.text }}
                >
                  <div className="mb-3 h-8 rounded-md" style={{ background: `linear-gradient(90deg, ${preset.accent}, ${preset.page})` }} />
                  <p className="font-black">{preset.name}</p>
                  <p className="mt-1 text-xs font-semibold opacity-70">Writing colors and workspace mood</p>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-700">
                  <SlidersHorizontal className="h-4 w-4" />
                  <p className="text-xs font-black uppercase tracking-widest">Customize</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="Accent" value={theme.accent} onChange={(accent) => updateTheme({ accent })} />
                  <ColorInput label="Page" value={theme.page} onChange={(page) => updateTheme({ page })} />
                  <ColorInput label="Panel" value={theme.panel} onChange={(panel) => updateTheme({ panel })} />
                  <ColorInput label="Text" value={theme.text} onChange={(text) => updateTheme({ text })} />
                  <ColorInput label="Paper" value={theme.writingBg} onChange={(writingBg) => updateTheme({ writingBg })} />
                  <ColorInput label="Lines" value={theme.line} onChange={(line) => updateTheme({ line })} />
                </div>
                <label className="mt-3 block text-xs font-black uppercase tracking-widest text-slate-500">
                  Writing Font
                  <select
                    value={theme.font}
                    onChange={(event) => updateTheme({ font: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold normal-case text-slate-900 outline-none"
                  >
                    {themeFontOptions.map((font) => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white">
                <ImagePlus className="h-4 w-4" />
                Import background from gallery
                <input type="file" accept="image/*" onChange={importImage} className="hidden" />
              </label>
              {theme.image && <div className="mt-3 h-28 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${theme.image}")` }} />}
              {theme.image && (
                <button onClick={clearImage} className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
                  Remove imported background
                </button>
              )}
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                Images are compressed before saving in this browser, so localStorage keeps working.
              </p>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="text-xs font-black uppercase tracking-widest text-slate-500">
      {label}
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-9 cursor-pointer border-0 bg-transparent p-0" />
        <span className="text-xs font-bold normal-case text-slate-700">{value}</span>
      </div>
    </label>
  );
}

function shrinkImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
