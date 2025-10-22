/* ===============================================
   Finance App – default.js
   Shared script for all pages.
   Loads header/footer, sets active nav link,
   and manages account dropdown interactions.

   + Reusable API helpers (JWT-aware):
     - API.uploadFile(file, { vendor, total, date, notes })
     - API.addEntry({ type, amount, currency, category, date, vendor, description, sourceReceiptId })
     - API.listReceipts(limit), API.deleteReceipt(id), API.downloadReceipt(id)
   =============================================== */

/* ---------------------- API base + tiny client ---------------------- */

// Normalize API_BASE (supports ?api=..., window.API_BASE, or default)
let __rawBase =
  new URLSearchParams(location.search).get("api") ||
  (typeof window.API_BASE === "string" && window.API_BASE) ||
  "http://localhost:4000";

__rawBase = String(__rawBase).replace(/\/$/, "");
const __API_BASE = /\/api$/.test(__rawBase) ? __rawBase : __rawBase + "/api";

function __authHeader() {
  const t = localStorage.getItem("authToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// (Optional) Dev bootstrap — call from pages that need it before API usage
async function ensureAuth(silent = true) {
  const token = localStorage.getItem("authToken");
  if (token && token.length > 10) return token;

  const devEmail = localStorage.getItem("authEmail") || "you@example.com";
  try {
    const res = await fetch(`${__API_BASE}/auth/signup-or-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: devEmail, name: devEmail.split("@")[0] })
    });
    const data = await res.json();
    if (!res.ok || !data?.token) throw new Error(data?.error || "Auth failed");
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("authEmail", data.user?.email || devEmail);
    return data.token;
  } catch (err) {
    if (!silent) console.error("Auth bootstrap failed:", err);
    throw err;
  }
}

async function __apiFetch(path, opts = {}) {
  return fetch(`${__API_BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), ...__authHeader() },
  });
}

async function __apiJSON(path, opts = {}) {
  const res = await __apiFetch(path, opts);
  const txt = await res.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

/* ---------------------- Reusable API helpers ---------------------- */

/**
 * Upload a single file to /api/receipts/upload (GridFS + metadata)
 * @param {File|Blob} file
 * @param {{vendor?:string,total?:number|string,date?:string,notes?:string}} meta
 * @returns {Promise<{id:string,fileId:string}>}
 */
async function uploadFile(file, meta = {}) {
  if (!(file instanceof Blob)) throw new Error("uploadFile: 'file' must be a File/Blob");
  await ensureAuth(true);

  const fd = new FormData();
  fd.append("file", file, /** @type {any} */(file).name || "upload");
  if (meta.vendor) fd.append("vendor", String(meta.vendor));
  if (meta.total != null && meta.total !== "") fd.append("total", String(meta.total));
  if (meta.date) fd.append("date", String(meta.date));
  if (meta.notes) fd.append("notes", String(meta.notes));

  return __apiJSON(`/receipts/upload`, { method: "POST", body: fd });
}

/**
 * Create a normalized record in /api/records
 * @param {{type?:'expense'|'income',amount:number|string,currency?:string,category?:string,date?:string,vendor?:string,description?:string,sourceReceiptId?:string}} entry
 * @returns {Promise<{id:string}>}
 */
async function addEntry(entry) {
  await ensureAuth(true);
  const payload = { ...(entry || {}) };
  if (payload.amount != null) payload.amount = Number(payload.amount);
  return __apiJSON(`/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function listReceipts(limit = 50) {
  await ensureAuth(true);
  return __apiJSON(`/receipts?limit=${encodeURIComponent(limit)}`);
}
async function deleteReceipt(id) {
  await ensureAuth(true);
  return __apiJSON(`/receipts/${encodeURIComponent(id)}`, { method: "DELETE" });
}
async function downloadReceipt(id) {
  await ensureAuth(true);
  const res = await __apiFetch(`/receipts/${encodeURIComponent(id)}/file`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

// Expose for all pages
window.API = {
  BASE: __API_BASE,
  ensureAuth,
  authHeader: __authHeader,
  fetch: __apiFetch,
  json: __apiJSON,
  uploadFile,
  addEntry,
  listReceipts,
  deleteReceipt,
  downloadReceipt,
};

/* ---------------------- Your original UI code (unchanged) ---------------------- */

document.addEventListener("DOMContentLoaded", () => {
  loadHeaderAndFooter();
});

/**
 * Fetch and inject header & footer, then set active nav link
 */
function loadHeaderAndFooter() {
  // --- Load Header ---
  fetch("components/header.html")
    .then((res) => {
      if (!res.ok) throw new Error("Header not found");
      return res.text();
    })
    .then((html) => {
      document.getElementById("header").innerHTML = html;
      setActiveNavLink();
      initAccountMenu(); // initialize dropdown behavior after header loads
    })
    .catch((err) => console.error("Header load failed:", err));

  // --- Load Footer ---
  fetch("components/footer.html")
    .then((res) => {
      if (!res.ok) throw new Error("Footer not found");
      return res.text();
    })
    .then((html) => {
      document.getElementById("footer").innerHTML = html;
    })
    .catch((err) => console.error("Footer load failed:", err));
}

/**
 * Highlights the current page in the navigation menu
 */
function setActiveNavLink() {
  const currentPage = window.location.pathname.split("/").pop();
  const navLinks = document.querySelectorAll("#header nav a");

  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href");
    if (linkPage === currentPage) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

/**
 * Initializes account menu dropdown toggle behavior
 */
function initAccountMenu() {
  const icon = document.getElementById("account-icon");
  const menu = document.getElementById("account-menu");

  if (!icon || !menu) return;

  // Toggle dropdown visibility on icon click
  icon.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("show");
    icon.setAttribute("aria-expanded", isOpen);
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!icon.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("show");
      icon.setAttribute("aria-expanded", "false");
    }
  });

  // Allow ESC key to close
  icon.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu.classList.remove("show");
      icon.setAttribute("aria-expanded", "false");
      icon.blur();
    }
  });
}
