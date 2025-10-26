/* ===============================================
   Finance App — upload.js (ES module)
   Drag & drop / file picker → POST to backend /api/receipts
   Lists & deletes via /api/receipts using api.js helpers.
   =============================================== */

import { api, API_BASE } from "./api.js";

(function () {
  // All calls go through API_BASE (ends with /api)
  const UPLOAD_URL = `${API_BASE}/receipts`;

  const ACCEPTED = ["application/pdf", "image/png", "image/jpeg"];
  const MAX_MB = 50;

  // ---- Elements ----
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const uploadBtn = document.getElementById("uploadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const statusMsg = document.getElementById("statusMsg");
  const recentTableBody = document.getElementById("recentTableBody");

  if (!dropzone || !fileInput) {
    console.error("upload.js: Missing #dropzone or #fileInput in the DOM.");
    return;
  }

  let queue = [];
  let pickerArmed = false;

  // ---------- Helpers ----------
  const setStatus = (msg, isError = false) => {
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    statusMsg.classList.toggle("error", !!isError);
  };

  const bytesToSize = (bytes) => {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0, n = bytes || 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const fixed = n >= 10 || i === 0 ? 0 : 1;
    return `${n.toFixed(fixed)} ${units[i]}`;
  };

  const extFromName = (name) => (name.includes(".") ? name.split(".").pop().toUpperCase() : "");
  const isAccepted = (file) => {
    if (ACCEPTED.includes(file.type)) return true;
    const ext = extFromName(file.name).toLowerCase();
    return ["pdf", "png", "jpg", "jpeg"].includes(ext);
  };
  const overLimit = (file) => file.size > MAX_MB * 1024 * 1024;

  async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, { credentials: "include", ...opts });
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

  // ---------- Recent uploads ----------
  const trashSVG = `<img src="images/trash.jpg" alt="Delete" class="icon-trash" />`;

  function renderRecentRows(rows) {
    recentTableBody.innerHTML = "";
    if (!rows.length) {
      recentTableBody.innerHTML = `<tr><td colspan="6" class="subtle">No uploads yet.</td></tr>`;
      return;
    }
    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.dataset.id = r._id;
      const when = r.uploaded_at ? new Date(r.uploaded_at).toLocaleString() : "—";
      tr.innerHTML = `
        <td>${r.original_filename || r.stored_filename || "—"}</td>
        <td>${r.mimetype || "—"}</td>
        <td class="num">${(r.size_bytes && bytesToSize(r.size_bytes)) || "—"}</td>
        <td>${when}</td>
        <td>${r.parse_status || "raw"}</td>
        <td class="num">
          <button class="icon-btn js-delete" data-id="${r._id}" title="Delete" aria-label="Delete this receipt">
            ${trashSVG}
          </button>
        </td>
      `;
      recentTableBody.appendChild(tr);
    }
  }

  async function refreshRecent() {
    try {
      const rows = await api.listReceipts(); // GET /api/receipts
      renderRecentRows(rows || []);
    } catch (err) {
      if ((err.message || "").toLowerCase().includes("not")) {
        const url = new URL("./login.html", location.href);
        url.searchParams.set("redirect", "upload.html");
        location.href = url.toString();
        return;
      }
      recentTableBody.innerHTML = `<tr><td colspan="6" class="subtle">Failed to load uploads.</td></tr>`;
    }
  }

  // ---------- Delete buttons ----------
  recentTableBody?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".js-delete");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (!id) return;
    const row = btn.closest("tr");

    if (!confirm("Delete this receipt? This removes the DB record and attempts to delete the file on disk.")) return;

    btn.disabled = true;
    try {
      await api.deleteReceipt(id); // DELETE /api/receipts/:id
      if (row && row.parentNode) row.parentNode.removeChild(row);
      if (!recentTableBody.querySelector("tr")) await refreshRecent();
      setStatus("Deleted.");
    } catch (err) {
      setStatus(`Delete failed: ${err.message}`, true);
      btn.disabled = false;
    }
  });

  // ---------- Queue ----------
  function renderQueue() {
    fileList.innerHTML = "";
    const hasItems = queue.length > 0;
    uploadBtn.disabled = !hasItems;
    if (!hasItems) return;

    queue.forEach((file, idx) => {
      const item = document.createElement("div");
      item.className = "file-item";

      const thumb = document.createElement("div");
      thumb.className = "file-thumb";

      if ((file.type || "").startsWith("image/")) {
        const img = document.createElement("img");
        img.alt = "";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        const reader = new FileReader();
        reader.onload = (e) => (img.src = e.target.result);
        reader.readAsDataURL(file);
        thumb.appendChild(img);
      } else {
        thumb.textContent = extFromName(file.name) || "FILE";
      }

      const meta = document.createElement("div");
      meta.className = "file-meta";
      const name = document.createElement("div");
      name.className = "file-name";
      name.textContent = file.name;
      const sub = document.createElement("div");
      sub.className = "file-subtle";
      sub.textContent = `${file.type || "Unknown"} • ${bytesToSize(file.size)}`;
      meta.appendChild(name);
      meta.appendChild(sub);

      const actions = document.createElement("div");
      actions.className = "file-actions";
      const removeBtn = document.createElement("button");
      removeBtn.className = "file-remove";
      removeBtn.type = "button";
      removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        queue.splice(idx, 1);
        renderQueue();
      });
      actions.appendChild(removeBtn);

      item.appendChild(thumb);
      item.appendChild(meta);
      item.appendChild(actions);
      fileList.appendChild(item);
    });
  }

  function addFiles(files) {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    const accepted = [];
    let rejected = 0;

    incoming.forEach(f => {
      if (!isAccepted(f) || overLimit(f)) { rejected++; return; }
      accepted.push(f);
    });

    if (accepted.length) {
      queue = queue.concat(accepted);
      renderQueue();
      setStatus(`${accepted.length} file(s) added.`);
    }
    if (rejected > 0) {
      setStatus(`${rejected} file(s) skipped (PDF/PNG/JPG only, ≤ ${MAX_MB} MB).`, true);
    }
  }

  // ---------- Picker ----------
  function openPickerOnce() {
    if (!fileInput || pickerArmed) return;
    pickerArmed = true;
    const disarm = () => { pickerArmed = false; };
    const onChange = () => { disarm(); fileInput.removeEventListener("change", onChange); };
    fileInput.addEventListener("change", onChange, { once: true });
    setTimeout(disarm, 2500);
    try { fileInput.showPicker?.() ?? fileInput.click(); } catch { fileInput.click(); }
  }

  fileInput.addEventListener("click", (e) => e.stopPropagation(), true);
  dropzone.addEventListener("click", () => openPickerOnce(), true);
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPickerOnce(); }
  });
  fileInput.addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });

  ["dragenter","dragover"].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add("is-dragover"); }));
  ["dragleave","drop"].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); if (evt === "drop" && e.dataTransfer?.files) addFiles(e.dataTransfer.files); dropzone.classList.remove("is-dragover"); }));

  clearBtn?.addEventListener("click", () => { queue=[]; fileInput.value=""; renderQueue(); setStatus("Cleared selection."); });

  // ---------- Upload all queued files ----------
  async function uploadAll() {
    while (queue.length > 0) {
      const file = queue[0];
      const fd = new FormData();
      fd.append("receipt", file, file.name);

      uploadBtn.disabled = true;
      dropzone?.setAttribute("aria-busy", "true");
      setStatus(`Uploading ${file.name}…`);

      try {
        // Correct endpoint: POST /api/receipts
        await fetchJSON(UPLOAD_URL, { method: "POST", body: fd });
        setStatus(`Uploaded: ${file.name}`);
        queue.shift();
        renderQueue();
        await refreshRecent();
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          const url = new URL("./login.html", location.href);
          url.searchParams.set("redirect", "upload.html");
          location.href = url.toString();
          return;
        }
        setStatus(`Upload failed: ${err.message}`, true);
        break;
      } finally {
        dropzone?.removeAttribute("aria-busy");
      }
    }
    uploadBtn.disabled = queue.length === 0;
  }

  uploadBtn?.addEventListener("click", uploadAll);

  // ---------- Init ----------
  renderQueue();
  refreshRecent();
})();