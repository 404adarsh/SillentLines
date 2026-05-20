import { todayIndiaInput } from "./format";

export const GUEST_DRAFT_KEY = "silentlines_guest_diary_draft_v1";

export function emptyGuestDraft() {
  return {
    title: "",
    content: "",
    mood: "gratitude",
    entryDate: todayIndiaInput(),
    updatedAt: "",
    source: "guest",
  };
}

export function loadGuestDraft() {
  try {
    const value = JSON.parse(localStorage.getItem(GUEST_DRAFT_KEY) || "null");
    if (!value || typeof value !== "object") return null;
    return {
      ...emptyGuestDraft(),
      ...value,
      title: String(value.title || ""),
      content: String(value.content || ""),
      mood: String(value.mood || "gratitude"),
      entryDate: /^\d{4}-\d{2}-\d{2}$/.test(value.entryDate || "") ? value.entryDate : todayIndiaInput(),
    };
  } catch {
    return null;
  }
}

export function hasGuestDraft() {
  const draft = loadGuestDraft();
  return Boolean(draft && (draft.content.trim() || draft.title.trim()));
}

export function saveGuestDraft(draft) {
  const next = {
    ...emptyGuestDraft(),
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("silentlines-guest-draft-updated"));
  return next;
}

export function clearGuestDraft() {
  localStorage.removeItem(GUEST_DRAFT_KEY);
  window.dispatchEvent(new Event("silentlines-guest-draft-updated"));
}
