export const requiredEditorButtons = new Set(["save", "reset"]);

const allowedEffects = new Set(["paper", "sparkle", "glow", "rain", "night"]);
const allowedStickers = new Set(["star", "heart", "note", "spark", "moon", "flower"]);
const allowedMenuShortcuts = new Set(["home", "profile", "write", "notes", "archive", "daily", "people", "trade", "portfolio", "accounts", "programming", "calendar", "tutorial", "safety", "contact", "settings", "tools"]);

export const menuShortcutOptions = [
  { id: "home", label: "Home", path: "/" },
  { id: "profile", label: "My Profile", path: "/profile" },
  { id: "write", label: "Write Diary", path: "/moodselect" },
  { id: "notes", label: "Saved Notes", path: "/notes" },
  { id: "archive", label: "Archive", path: "/archive" },
  { id: "daily", label: "Daily Workspace", path: "/daily-workspace" },
  { id: "people", label: "People Memory", path: "/people" },
  { id: "trade", label: "Trade Journal", path: "/trade-journal" },
  { id: "portfolio", label: "Portfolio", path: "/dashboard" },
  { id: "accounts", label: "Accounts Journal", path: "/accounts-journal" },
  { id: "programming", label: "Programming Journal", path: "/programming-journal" },
  { id: "calendar", label: "Mood Calendar", path: "/calendar" },
  { id: "tutorial", label: "Tutorial", path: "/about" },
  { id: "safety", label: "Safety", path: "/safety" },
  { id: "contact", label: "Support", path: "/contact" },
  { id: "tools", label: "Tools", path: "/tools" },
  { id: "settings", label: "Settings", path: "/settings" },
];

export const defaultEditorCustomize = {
  brand_name: "SilentLines",
  logo_image: "",
  code_mode: false,
  ai_enabled: true,
  ai_blocked: false,
  accessibility_labels: true,
  navigation_assistant: true,
  menu_shortcuts: ["home", "profile", "write", "notes", "archive", "daily", "people", "settings", "contact"],
  effects: [],
  stickers: [],
  buttons: [
    { id: "save", label: "Save", visible: true, required: true },
    { id: "image", label: "Image", visible: true, required: false },
    { id: "code", label: "Code", visible: true, required: false },
    { id: "burn", label: "Burn", visible: true, required: false },
    { id: "share", label: "Share", visible: true, required: false },
    { id: "commits", label: "Commits", visible: true, required: false },
    { id: "reset", label: "Reset Layout", visible: true, required: true },
  ],
};

export function normalizeEditorCustomize(value = {}) {
  const incomingButtons = Array.isArray(value.buttons) ? value.buttons : [];
  const byId = new Map(incomingButtons.map((button) => [button.id, button]));
  const known = defaultEditorCustomize.buttons.map((button) => {
    const incoming = byId.get(button.id) || {};
    const required = requiredEditorButtons.has(button.id);
    return {
      ...button,
      visible: required ? true : incoming.visible !== false,
      required,
    };
  });
  const ordered = incomingButtons
    .map((button) => known.find((item) => item.id === button.id))
    .filter(Boolean);
  const missing = known.filter((button) => !ordered.some((item) => item.id === button.id));
  const normalizeList = (items, allowed) =>
    Array.from(new Set((Array.isArray(items) ? items : []).map((item) => String(item).trim()).filter((item) => allowed.has(item))));

  return {
    ...defaultEditorCustomize,
    ...value,
    brand_name: typeof value.brand_name === "string" ? value.brand_name.trim().slice(0, 60) || "SilentLines" : "SilentLines",
    logo_image: typeof value.logo_image === "string" ? value.logo_image : "",
    code_mode: Boolean(value.code_mode),
    ai_enabled: value.ai_enabled !== false,
    ai_blocked: Boolean(value.ai_blocked),
    accessibility_labels: value.accessibility_labels !== false,
    navigation_assistant: value.navigation_assistant !== false,
    menu_shortcuts: normalizeList(value.menu_shortcuts, allowedMenuShortcuts),
    effects: normalizeList(value.effects, allowedEffects),
    stickers: normalizeList(value.stickers, allowedStickers),
    buttons: [...ordered, ...missing],
  };
}

export function resetEditorCustomize() {
  return normalizeEditorCustomize(defaultEditorCustomize);
}

export function visibleEditorButtons(customize) {
  return normalizeEditorCustomize(customize).buttons.filter((button) => button.visible || button.required);
}

export function insertCodeBlock(text, language = "") {
  const cleanLang = language.replace(/[^a-z0-9+#_-]/gi, "");
  return `\n\n\`\`\`${cleanLang}\n${text || "write code here"}\n\`\`\`\n`;
}

export function shrinkImageFile(file, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Choose an image file."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image."));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export function imageMarkdown(dataUrl, name = "Diary image") {
  return `\n\n![${name.replace(/[[\]]/g, "")}](${dataUrl})\n\n`;
}

export const DIARY_PAGE_SEPARATOR = "\n\n--- page break ---\n\n";
export const DIARY_PAGE_TITLE_PREFIX = "[[page-title:";
export const DIARY_PAGE_TITLE_SUFFIX = "]]";

function extractPageTitle(pageText) {
  const trimmed = pageText.trimStart();
  if (!trimmed.startsWith(DIARY_PAGE_TITLE_PREFIX)) {
    return { title: "", body: pageText.trim() };
  }
  const endIndex = trimmed.indexOf(DIARY_PAGE_TITLE_SUFFIX, DIARY_PAGE_TITLE_PREFIX.length);
  if (endIndex === -1) {
    return { title: "", body: pageText.trim() };
  }
  const title = trimmed.slice(DIARY_PAGE_TITLE_PREFIX.length, endIndex).trim();
  const body = trimmed.slice(endIndex + DIARY_PAGE_TITLE_SUFFIX.length).trimStart();
  return { title, body };
}

export function splitDiaryImages(text = "") {
  const images = [];
  const cleanText = String(text).replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, (_match, name, dataUrl) => {
    const label = name || `Image ${images.length + 1}`;
    images.push({ id: safeImageId(), name: label, dataUrl });
    return "";
  }).replace(/\n{3,}/g, "\n\n").trimEnd();

  return { text: cleanText, images };
}

export function splitDiaryPages(entryText = "") {
  return String(entryText)
    .split(DIARY_PAGE_SEPARATOR)
    .map((pageText) => {
      const { title, body } = extractPageTitle(pageText);
      const page = splitDiaryImages(body);
      return {
        title,
        text: page.text,
        images: page.images,
      };
    })
    .filter((page) => page.title || page.text.trim() || page.images.length > 0);
}

export function composeDiaryPages(pages = []) {
  return pages
    .map((page) => {
      const titleBlock = page.title ? `${DIARY_PAGE_TITLE_PREFIX}${page.title}${DIARY_PAGE_TITLE_SUFFIX}\n\n` : "";
      return `${titleBlock}${composeDiaryContent(page.text || "", page.images || [])}`.trim();
    })
    .join(DIARY_PAGE_SEPARATOR)
    .trim();
}

export function composeDiaryContent(text = "", images = []) {
  const strippedText = String(text).replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "").trimEnd();
  const uniqueImages = [];
  const seen = new Set();

  images.forEach((image) => {
    if (!image?.dataUrl || seen.has(image.dataUrl)) return;
    seen.add(image.dataUrl);
    uniqueImages.push({
      id: image.id || safeImageId(),
      name: image.name || "Diary image",
      dataUrl: image.dataUrl,
    });
  });

  const imageBlock = uniqueImages.map((image) => imageMarkdown(image.dataUrl, image.name || "Diary image")).join("");
  return `${strippedText}${imageBlock}`;
}

export function safeImageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeCustomizeButtons(buttons = []) {
  const normalized = normalizeEditorCustomize({ buttons }).buttons;
  return normalized;
}
