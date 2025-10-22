/* ===============================================
   Finance App — upload.js (UI glue only)
   Uses window.API helpers from default.js:
     - API.ensureAuth()
     - API.uploadFile(file, meta)
     - API.listReceipts(limit)
     - API.deleteReceipt(id)
     - API.downloadReceipt(id)
   =============================================== */

(function () {
  if (!window.API) {
    console.error("upload.js: window.API not found. Make sure scripts/default.js loads first.");
    return;
  }

  // ---------- Config ----------
  const ACCEPTED = ["application/pdf", "image/png", "image/jpeg"];
  const MAX_MB = 50;

  // ---------- DOM ----------
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const uploadBtn = document.getElementById("uploadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const statusMsg = document.getElementById("statusMsg");
  const recentTableBody = document.getElementById("recentTableBody");
  const allTableBody = document.getElementById("allTableBody"); // from updated HTML

  if (!dropzone || !fileInput) {
    console.error("upload.js: Missing #dropzone or #fileInput in the DOM.");
    return;
  }

  // ---------- State ----------
  let queue = [];
  let pickerArmed = false;

  // ---------- Helpers ----------
  const setStatus = (msg, isError = false) => {
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    statusMsg.classList.toggle("error", !!isError);
  };

  const bytesToSize = (bytes = 0) => {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const fixed = n >= 10 || i === 0 ? 0 : 1;
    return `${n.toFixed(fixed)} ${units[i]}`;
  };

  const extFromName = (name) => (name && name.includes(".")) ? name.split(".").pop().toUpperCase() : "";
  const isAccepted = (file) => {
    if (ACCEPTED.includes(file.type)) return true;
    const ext = extFromName(file.name).toLowerCase();
    return ["pdf", "png", "jpg", "jpeg"].includes(ext);
  };
  const overLimit = (file) => file.size > MAX_MB * 1024 * 1024;

  // ---------- Renderers ----------
  function renderRecentRows(rows) {
    recentTableBody.innerHTML = "";
    const list = (rows || []).slice(0, 3);
    if (!list.length) {
      recentTableBody.innerHTML = `<tr><td colspan="5" class="subtle">No uploads yet.</td></tr>`;
      return;
    }
    for (const r of list) {
      const when = r.date ? new Date(r.date).toLocaleString() : "—";
      const parseStatus = r.parsed ? "parsed" : "raw";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.originalName || "—"}</td>
        <td>${"—"}</td>
        <td class="num">${"—"}</td>
        <td>${when}</td>
        <td>${parseStatus}</td>
      `;
      recentTableBody.appendChild(tr);
    }
  }

  const iconTrash = `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9z" fill="currentColor"/>
    </svg>`;
  const iconDownload = `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 20h14v-2H5v2zM12 2v12l4-4 1.41 1.41L12 17.83l-5.41-5.42L8 10l4 4V2h0z" fill="currentColor"/>
    </svg>`;

  function renderAllRows(rows) {
    if (!allTableBody) return;
    allTableBody.innerHTML = "";
    const list = rows || [];
    if (!list.length) {
      allTableBody.innerHTML = `<tr><td colspan="6" class="subtle">No uploads yet.</td></tr>`;
      return;
    }
    for (const r of list) {
      const when = r.date ? new Date(r.date).toLocaleString() : "—";
      const parseStatus = r.parsed ? "parsed" : "raw";
      const tr = document.createElement("tr");
      tr.dataset.id = r.id;
      tr.innerHTML = `
        <td>${r.originalName || "—"}</td>
        <td>${"—"}</td>
        <td class="num">${"—"}</td>
        <td>${when}</td>
        <td>${parseStatus}</td>
        <td class="num actions">
          <button class="icon-btn js-download" data-id="${r.id}" data-name="${r.originalName || "receipt.pdf"}" title="Download" aria-label="Download">
            ${iconDownload}
          </button>
          <button class="icon-btn js-delete" data-id="${r.id}" title="Delete" aria-label="Delete">
            ${iconTrash}
          </button>
        </td>
      `;
      allTableBody.appendChild(tr);
    }
  }

  async function refreshTables() {
    try {
      const rows = await window.API.listReceipts(100);
      renderRecentRows(rows);
      renderAllRows(rows);
    } catch (err) {
      recentTableBody.innerHTML = `<tr><td colspan="5" class="subtle">Failed to load uploads.</td></tr>`;
      if (allTableBody) {
        allTableBody.innerHTML = `<tr><td colspan="6" class="subtle">Failed to load uploads.</td></tr>`;
      }
    }
  }

  // ---------- Actions (All uploads) ----------
  allTableBody?.addEventListener("click", async (e) => {
    const delBtn = e.target.closest(".js-delete");
    if (delBtn) {
      const id = delBtn.getAttribute("data-id");
      if (!id) return;
      if (!confirm("Delete this receipt? This removes the DB record and stored file.")) return;

      delBtn.disabled = true;
      try {
        await window.API.deleteReceipt(id);
        setStatus("Deleted.");
        await refreshTables();
      } catch (err) {
        setStatus(`Delete failed: ${err.message}`, true);
        delBtn.disabled = false;
      }
      return;
    }

    const dlBtn = e.target.closest(".js-download");
    if (dlBtn) {
      const id = dlBtn.getAttribute("data-id");
      const name = dlBtn.getAttribute("data-name") || "receipt.pdf";
      if (!id) return;

      dlBtn.disabled = true;
      setStatus("Preparing download…");
      try {
        const blob = await window.API.downloadReceipt(id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus("Download started.");
      } catch (err) {
        setStatus(`Download failed: ${err.message}`, true);
      } finally {
        dlBtn.disabled = false;
      }
    }
  });

  // ---------- Queue UI ----------
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
        thumb.textContent = (extFromName(file.name) || "FILE");
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

    incoming.forEach((f) => {
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

  // ---------- Picker + DnD ----------
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

  ["dragenter","dragover"].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation(); dropzone.classList.add("is-dragover");
  }));
  ["dragleave","drop"].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation();
    if (evt === "drop" && e.dataTransfer?.files) addFiles(e.dataTransfer.files);
    dropzone.classList.remove("is-dragover");
  }));

  clearBtn?.addEventListener("click", () => {
    queue = []; fileInput.value = ""; renderQueue(); setStatus("Cleared selection.");
  });

  // ---------- Upload all queued files ----------
  async function uploadAll() {
    // Ensure auth once (default.js handles token + storage)
    try { await window.API.ensureAuth(true); } catch (e) {
      setStatus(`Auth failed: ${e.message}`, true);
      return;
    }

    while (queue.length > 0) {
      const file = queue[0];

      uploadBtn.disabled = true;
      dropzone?.setAttribute("aria-busy", "true");
      setStatus(`Uploading ${file.name}…`);

      try {
        await window.API.uploadFile(file /*, optional meta: { vendor, total, date }*/);
        setStatus(`Uploaded: ${file.name}`);
        queue.shift();
        renderQueue();
        await refreshTables();
      } catch (err) {
        setStatus(`Upload failed: ${err.message}`, true);
        break; // stop queue on error
      } finally {
        dropzone?.removeAttribute("aria-busy");
      }
    }
    uploadBtn.disabled = queue.length === 0;
  }

  uploadBtn?.addEventListener("click", uploadAll);

  // ---------- Init ----------
  renderQueue();
  // Make first API call smooth by ensuring auth silently
  window.API.ensureAuth(true).finally(refreshTables);
})();
