export const THEME_STORAGE_KEY = "silentlines_theme_v2";

export const themePresets = [
  {
    id: "morning",
    name: "Morning Paper",
    accent: "#0f766e",
    page: "#f7f8f3",
    panel: "#ffffff",
    text: "#0f172a",
    writingBg: "#fffaf0",
    line: "#e7d8bd",
    font: "'Caveat', cursive",
  },
  {
    id: "midnight",
    name: "Midnight Focus",
    accent: "#60a5fa",
    page: "#0f172a",
    panel: "#111827",
    text: "#e5e7eb",
    writingBg: "#101827",
    line: "#263449",
    font: "'Caveat', cursive",
  },
  {
    id: "rose",
    name: "Rose Calm",
    accent: "#be123c",
    page: "#fff1f2",
    panel: "#ffffff",
    text: "#1f2937",
    writingBg: "#fff7f8",
    line: "#f5c2ca",
    font: "'Caveat', cursive",
  },
  {
    id: "coder",
    name: "Coder Desk",
    accent: "#22c55e",
    page: "#07130f",
    panel: "#0f172a",
    text: "#e2e8f0",
    writingBg: "#0b1220",
    line: "#1f3b2d",
    font: "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
  },
  {
    id: "forest",
    name: "Forest Letter",
    accent: "#15803d",
    page: "#eef7ee",
    panel: "#ffffff",
    text: "#102116",
    writingBg: "#fbfff8",
    line: "#cfe7cf",
    font: "'Georgia', serif",
  },
  {
    id: "lavender",
    name: "Lavender Night",
    accent: "#8b5cf6",
    page: "#f5f3ff",
    panel: "#ffffff",
    text: "#24133f",
    writingBg: "#fdfbff",
    line: "#ddd6fe",
    font: "'Caveat', cursive",
  },
  {
    id: "ink",
    name: "Ink Classic",
    accent: "#334155",
    page: "#f8fafc",
    panel: "#ffffff",
    text: "#0f172a",
    writingBg: "#ffffff",
    line: "#dbe3ef",
    font: "'Georgia', serif",
  },
  {
    id: "sunset",
    name: "Sunset Warmth",
    accent: "#dc2626",
    page: "#fff7ed",
    panel: "#ffffff",
    text: "#30120b",
    writingBg: "#fffaf5",
    line: "#fed7aa",
    font: "'Caveat', cursive",
  },
];

const fallbackTheme = themePresets[0];

const fontOptions = [
  "'Caveat', cursive",
  "'Georgia', serif",
  "'Inter', system-ui, sans-serif",
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
];

export const themeFontOptions = [
  { label: "Diary Hand", value: fontOptions[0] },
  { label: "Classic Serif", value: fontOptions[1] },
  { label: "Clean Sans", value: fontOptions[2] },
  { label: "Code Mono", value: fontOptions[3] },
];

export function loadTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "null");
    return normalizeTheme(saved || fallbackTheme);
  } catch {
    return fallbackTheme;
  }
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalizeTheme(theme)));
  window.dispatchEvent(new Event("silentlines-theme-updated"));
}

export function applyTheme(theme) {
  const safeTheme = normalizeTheme(theme);
  const root = document.documentElement;
  root.style.setProperty("--sl-accent", safeTheme.accent);
  root.style.setProperty("--sl-page", safeTheme.page);
  root.style.setProperty("--sl-panel", safeTheme.panel);
  root.style.setProperty("--sl-text", safeTheme.text);
  root.style.setProperty("--sl-writing-bg", safeTheme.writingBg);
  root.style.setProperty("--sl-writing-text", readableTextOn(safeTheme.writingBg));
  root.style.setProperty("--sl-writing-line", safeTheme.line);
  root.style.setProperty("--sl-font", safeTheme.font);
  root.style.setProperty("--sl-theme-image", safeTheme.image ? `url("${safeTheme.image}")` : "none");
}

export function normalizeTheme(theme = {}) {
  const next = { ...fallbackTheme, ...theme };
  next.accent = cleanHex(next.accent, fallbackTheme.accent);
  next.page = cleanHex(next.page, fallbackTheme.page);
  next.panel = cleanHex(next.panel, fallbackTheme.panel);
  next.text = ensureReadable(cleanHex(next.text, fallbackTheme.text), next.panel);
  next.writingBg = cleanHex(next.writingBg, fallbackTheme.writingBg);
  next.line = cleanHex(next.line, fallbackTheme.line);
  next.font = fontOptions.includes(next.font) ? next.font : fallbackTheme.font;
  next.image = typeof next.image === "string" ? next.image : "";
  return next;
}

function cleanHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function ensureReadable(text, background) {
  if (contrastRatio(text, background) >= 4.5) return text;
  return luminance(background) > 0.45 ? "#0f172a" : "#f8fafc";
}

function readableTextOn(background) {
  return luminance(background) > 0.45 ? "#1f2937" : "#f8fafc";
}

function contrastRatio(a, b) {
  const bright = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (bright + 0.05) / (dark + 0.05);
}

function luminance(hex) {
  const rgb = hex.replace("#", "").match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
  const [r, g, b] = rgb.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
