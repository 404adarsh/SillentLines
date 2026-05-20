export const INDIA_TIME_ZONE = "Asia/Kolkata";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MYSQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/;
const HAS_TIME_ZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function dateInIndia(value, fallback = new Date()) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value;
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date;
  }

  const raw = String(value).trim();
  let normalized = raw;
  if (DATE_ONLY_RE.test(raw)) {
    normalized = `${raw}T00:00:00+05:30`;
  } else if (MYSQL_DATETIME_RE.test(raw) && !HAS_TIME_ZONE_RE.test(raw)) {
    normalized = `${raw.replace(" ", "T")}+05:30`;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export function formatIndiaDate(value, options = {}) {
  const hasOptions = Object.keys(options).length > 0;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    ...(hasOptions ? options : { day: "numeric", month: "short", year: "numeric" }),
  }).format(dateInIndia(value));
}

export function formatIndiaDateTime(value, options = {}) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  }).format(dateInIndia(value));
}

export function todayIndiaInput() {
  return dateInputIndia(new Date());
}

export function dateInputIndia(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dateInIndia(value));
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function publicUserLabel(person = {}, fallback = "Diary user") {
  const name = person.full_name || person.name || person.author_name;
  const username = person.username || person.author_username;
  if (name && !String(name).includes("@")) return String(name);
  if (username) return `@${String(username).replace(/^@/, "")}`;
  return fallback;
}

export function publicUsername(person = {}) {
  const username = person.username || person.author_username;
  return username ? `@${String(username).replace(/^@/, "")}` : "";
}
