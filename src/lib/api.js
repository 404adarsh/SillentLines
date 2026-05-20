const DEFAULT_API_BASE = "http://localhost/SillentLines/php";

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_API_BASE;

export function apiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export function authUserPayload(user = {}) {
  const email = user.email || "";
  const fullName = user.name || user.full_name || user.nickname || "";
  const username = user.nickname || email.split("@")[0] || "";

  return {
    email,
    user_email: email,
    owner_email: email,
    name: fullName,
    full_name: fullName,
    user_full_name: fullName,
    username,
    user_username: username,
  };
}

export async function postJson(path, payload) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}
