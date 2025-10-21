// ========== HOME DASHBOARD LOGIC (no header/footer loading here) ==========
(() => {
  const DATA_URL = "data/sample.json"; // adjust if your path differs
  const CURRENCY_FALLBACK = "USD";

  const $ = (sel, root = document) => root.querySelector(sel);

  const fmtMoney = (value, currency) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: currency || CURRENCY_FALLBACK })
      .format((Number.isFinite(value) ? value : 0));

  const fmtDate = (iso) =>
    new Date(iso + (iso?.length === 10 ? "T00:00:00" : ""))
      .toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });

  // ---- Chart (simple canvas bar chart, no external libs)
  function drawBarChart(canvas, dataObj) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const entries = Object.entries(dataObj || {});
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => +e[1] || 0);
    const max = Math.max(1, ...values);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const P = { t: 20, r: 20, b: 50, l: 40 };
    const innerW = canvas.width - P.l - P.r;
    const innerH = canvas.height - P.t - P.b;

    // axes
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(P.l, P.t);
    ctx.lineTo(P.l, P.t + innerH);
    ctx.lineTo(P.l + innerW, P.t + innerH);
    ctx.stroke();

    const gap = 14;
    const barW = Math.max(10, (innerW - gap * (values.length + 1)) / Math.max(values.length, 1));
    const palette = ["#0057b8", "#00a3e0", "#1e3a8a", "#0ea5e9", "#2563eb", "#0891b2", "#3b82f6"];

    values.forEach((v, i) => {
      const h = (v / max) * (innerH - 10);
      const x = P.l + gap + i * (barW + gap);
      const y = P.t + innerH - h;
      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(x, y, barW, h);

      ctx.fillStyle = "#111827";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(v.toFixed(2)), x + barW / 2, y - 6);

      ctx.fillStyle = "#6b7280";
      ctx.save();
      ctx.translate(x + barW / 2, P.t + innerH + 16);
      ctx.rotate(-Math.PI / 10);
      ctx.fillText(labels[i], 0, 0);
      ctx.restore();
    });
  }

  function renderLegend(container, categories) {
    if (!container) return;
    container.innerHTML = "";
    const palette = ["#0057b8", "#00a3e0", "#1e3a8a", "#0ea5e9", "#2563eb", "#0891b2", "#3b82f6"];
    Object.keys(categories || {}).forEach((name, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.color = palette[i % palette.length];
      chip.innerHTML = `<span class="dot" aria-hidden="true"></span>${name}`;
      container.appendChild(chip);
    });
  }

  function renderBreakdown(listEl, categories, currency) {
    if (!listEl) return;
    listEl.innerHTML = "";
    const total = Object.values(categories || {}).reduce((a, b) => a + b, 0);
    Object.entries(categories || {})
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, amt]) => {
        const li = document.createElement("li");
        const pct = total ? Math.round((amt / total) * 100) : 0;
        li.innerHTML = `<span>${name}</span><span>${fmtMoney(amt, currency)} (${pct}%)</span>`;
        listEl.appendChild(li);
      });
  }

  // ----- compute overview dynamically from JSON -----
  function computeOverview(json) {
    const expenses = (json.expenses || []).filter(Boolean);
    const income = (json.income || []).filter(Boolean);

    const currency =
      json.summary?.currency ||
      // try to infer from a txn if you ever add a currency field there; else fallback:
      CURRENCY_FALLBACK;

    const total_spending = expenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const total_income   = income.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const net_balance    = total_income - total_spending;

    // build expense category totals for chart/breakdown
    const categories = expenses.reduce((acc, t) => {
      const key = t.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});

    // last updated: latest date seen across expenses + income; fallback to summary.last_updated
    const dates = [
      ...expenses.map(t => t.date),
      ...income.map(i => i.date),
    ].filter(Boolean);
    const latestISO = dates.length ? dates.sort().slice(-1)[0] : null;
    const last_updated = latestISO
      ? new Date(latestISO + (latestISO.length === 10 ? "T00:00:00" : "")).toISOString()
      : (json.summary?.last_updated || new Date().toISOString());

    return { total_spending, total_income, net_balance, currency, categories, last_updated };
  }

  function renderKpisFromComputed(comp) {
    $("#kpiIncome").textContent = fmtMoney(comp.total_income, comp.currency);
    $("#kpiSpending").textContent = fmtMoney(comp.total_spending, comp.currency);
    $("#kpiBalance").textContent = fmtMoney(comp.net_balance, comp.currency);
    $("#lastUpdated").textContent = `Data updated ${new Date(comp.last_updated).toLocaleString()}`;
  }

  function renderexpenses(tbody, txns, currency) {
    if (!tbody) return;
    tbody.innerHTML = "";
    (txns || [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .forEach(txn => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${fmtDate(txn.date)}</td>
          <td>${txn.source || ""}</td>
          <td>${txn.category || ""}</td>
          <td class="num">${fmtMoney(txn.amount, currency)}</td>
          <td>${txn.payment_method || ""}</td>
          <td>${txn.notes || ""}</td>
        `;
        tbody.appendChild(tr);
      });

    if (!tbody.children.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="subtle">No expenses yet.</td>`;
      tbody.appendChild(tr);
    }
  }

  async function loadData() {
    const resp = await fetch(DATA_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to load data (${resp.status})`);
    const json = await resp.json();
  
    const localTxns = JSON.parse(localStorage.getItem("userTxns") || "[]");
    const localExpenses = localTxns.filter(txn => txn.type === "expense");
    const localIncome = localTxns.filter(txn => txn.type === "income");
  
    json.expenses = [...(json.expenses || []), ...localExpenses];
    json.income = [...(json.income || []), ...localIncome];
  
    return json;
  }

  function wireActions() {
    const modal = $("#addTxnModal");
    const form = $("#txnForm");
    const btnCancel = $("#btnCancelModal");
  
    $("#btnUpload")?.addEventListener("click", () => alert("Open upload flow…"));
    $("#btnExport")?.addEventListener("click", () => alert("Exporting CSV…"));
  
    // Show modal
    $("#btnAddTxn")?.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });
  
    // Hide modal
    btnCancel?.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  
    // Handle Save
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
    
      const newTxn = {
        date: $("#txnDate").value,
        source: $("#txnSource").value,
        category: $("#txnCategory").value,
        amount: parseFloat($("#txnAmount").value),
        payment_method: $("#txnMethod").value,
        notes: $("#txnNotes").value
      };
    
      // Save transaction in localStorage
      const stored = JSON.parse(localStorage.getItem("userTxns") || "[]");
      stored.push(newTxn);
      localStorage.setItem("userTxns", JSON.stringify(stored));
    
      // Add visually to the table right away
      const tbody = $("#txnTbody");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDate(newTxn.date)}</td>
        <td>${newTxn.source}</td>
        <td>${newTxn.category}</td>
        <td class="num">${fmtMoney(newTxn.amount, "USD")}</td>
        <td>${newTxn.payment_method}</td>
        <td>${newTxn.notes}</td>
      `;
      tbody.prepend(tr);
    
      // Close modal and notify
      $("#addTxnModal").classList.add("hidden");
      alert("Transaction added successfully!");
    });    
  }
  

  function personalizeWelcome() {
    const name = (window.currentUser && window.currentUser.name) || null;
    $("#welcomeTitle").textContent = name ? `Welcome back, ${name}` : "Welcome back";
  }

  async function init() {
    // default.js already injected header/footer; this file only handles page logic.
    wireActions();
    personalizeWelcome();

    try {
      const data = await loadData();

      // 1) Compute overview from raw arrays (ignore summary totals)
      const computed = computeOverview(data);
      renderKpisFromComputed(computed);

      // 2) Recent expenses table (keep as expenses only, per your columns)
      renderexpenses($("#txnTbody"), data.expenses || [], computed.currency);

      // 3) Chart + legend + breakdown from computed expense categories
      const canvas = $("#categoriesChart");
      drawBarChart(canvas, computed.categories || {});
      renderLegend($("#chartLegend"), computed.categories || {});
      renderBreakdown($("#categoryList"), computed.categories || {}, computed.currency);
    } catch (err) {
      console.error(err);
      const status = $("#lastUpdated");
      if (status) status.textContent = "Could not load data.";
      const tb = $("#txnTbody");
      if (tb) tb.innerHTML = `<tr><td colspan="6" class="subtle">Failed to load expenses.</td></tr>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
