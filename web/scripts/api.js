// web/scripts/api.js
export const API_BASE = "http://localhost:4000/api";

async function request(path, { method = "GET", headers = {}, body, raw } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body,
    credentials: "include", // send/receive auth cookie
  });
  if (raw) return res;
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // auth
  register: (payload) =>
    request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),

  // records
  listRecords: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/records${q ? `?${q}` : ""}`);
  },
  createRecord: (payload) =>
    request("/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  // receipts
  uploadReceipt: (file) => {
    const fd = new FormData();
    fd.append("receipt", file);
    return request("/receipts", { method: "POST", body: fd });
  },
  listReceipts: () => request("/receipts"),
  getReceipt: (id) => request(`/receipts/${id}`),
  deleteReceipt: (id) => request(`/receipts/${id}`, { method: "DELETE" }),
};