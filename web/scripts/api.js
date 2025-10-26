// web/scripts/api.js
//
// Smart API base that auto-switches between local dev and production (Render).
// - Local (served via Live Server/HTTP): http://localhost:4000/api
// - Production (GitHub Pages):          https://financeappmy.onrender.com/api
// - Manual override: add ?api=https://custom-host.com to your page URL

// 1) Optional manual override via query string (?api=...)
const urlApiOverride = new URLSearchParams(window.location.search).get("api");

// 2) Known hosts/origins for local dev
const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);

// 3) Defaults
const PROD_API = "https://financeappmy.onrender.com/api";
const LOCAL_API = "http://localhost:4000/api";

// 4) Pick base
export const API_BASE = (urlApiOverride && urlApiOverride.replace(/\/$/, "")) ||
                        (isLocalHost ? LOCAL_API : PROD_API);

// If you ever need the root origin (without /api)
export const API_ORIGIN = API_BASE.replace(/\/api$/, "");

// ---- shared fetch helper (cookies on) ----
async function fetchJson(path, { method = "GET", headers = {}, body, formData } = {}) {
  const opts = {
    method,
    credentials: "include",
    headers,
  };

  if (formData) {
    // sending FormData (e.g., uploads)
    opts.body = formData;
  } else if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json", ...headers };
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ---- public API used by your pages ----
export const api = {
  // auth
  register: ({ name, email, password }) =>
    fetchJson("/auth/register", { method: "POST", body: { name, email, password } }),

  login: ({ email, password }) =>
    fetchJson("/auth/login", { method: "POST", body: { email, password } }),

  me: () => fetchJson("/auth/me"),

  logout: () => fetchJson("/auth/logout", { method: "POST" }),

  // records
  listRecords: () => fetchJson("/records"),
  createRecord: (payload) => fetchJson("/records", { method: "POST", body: payload }),

  // receipts
  listReceipts: () => fetchJson("/receipts"),
  getReceipt: (id) => fetchJson(`/receipts/${encodeURIComponent(id)}`),
  deleteReceipt: (id) => fetchJson(`/receipts/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // uploads via /api/receipts (multipart)
  uploadReceipt: async (file) => {
    const fd = new FormData();
    fd.append("receipt", file, file.name);
    return fetchJson("/receipts", { method: "POST", formData: fd });
  },
};