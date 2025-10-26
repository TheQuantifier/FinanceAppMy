// ========== HOME DASHBOARD LOGIC (no header/footer loading here) ==========
import { api } from "./api.js";

(() => {
  const DATA_URL = "data/sample.json"; // fallback if API unavailable
  const CURRENCY_FALLBACK = "USD";

  const $ = (sel, root = document) => root.querySelector(sel);

  const fmtMoney = (value, currency) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: currency || CURRENCY_FALLBACK })
      .format(Number.isFinite(+value) ? +value : 0);

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

  // ----- compute overview dynamically from normalized txns -----
  function computeOverview({ expenses = [], income = [] }) {
    const currency = (expenses[0]?.currency || income[0]?.currency) || CURRENCY_FALLBACK;

    const total_spending = expenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const total_income   = income.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const net_balance    = total_income - total_spending;

    const categories = expenses.reduce((acc, t) => {
      const key = t.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});

    const dates = [...expenses.map(t => t.date), ...income.map(i => i.date)].filter(Boolean);
    const latestISO = dates.length ? dates.sort().slice(-1)[0] : null;
    const last_updated = latestISO
      ? new Date(latestISO + (latestISO.length === 10 ? "T00:00:00" : "")).toISOString()
      : new Date().toISOString();

    return { total_spending, total_income, net_balance, currency, categories, last_updated };
  }

  function renderKpisFromComputed(comp) {
    $("#kpiIncome").textContent = fmtMoney(comp.total_income, comp.currency);
    $("#kpiSpending").textContent = fmtMoney(comp.total_spending, comp.currency);
    $("#kpiBalance").textContent = fmtMoney(comp.net_balance, comp.currency);
    $("#lastUpdated").textContent = `Data updated ${new Date(comp.last_updated).toLocaleString()}`;
  }

  function renderExpenses(tbody, txns, currency) {
    if (!tbody) return;
    tbody.innerHTML = "";
    (txns || [])
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .slice(-8) // last 8
      .reverse() // newest first
      .forEach(txn => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${fmtDate(txn.date)}</td>
          <td>${txn.source || ""}</td>
          <td>${txn.category || ""}</td>
          <td class="num">${fmtMoney(txn.amount, currency)}</td>
          <td>${txn.method || ""}</td>
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

  // Normalize data shape to { expenses, income }
  function normalizeForDashboard(records = [], fallbackJson = null) {
    if (records.length) {
      return {
        expenses: records.filter(r => (r.type || "expense") === "expense"),
        income:   records.filter(r => r.type === "income"),
      };
    }
    // Fallback to sample.json shape if provided
    if (fallbackJson) {
      const localTxns = JSON.parse(localStorage.getItem("userTxns") || "[]");
      const localExpenses = localTxns.filter(t => t.type === "expense");
      const localIncome = localTxns.filter(t => t.type === "income");

      return {
        expenses: [...(fallbackJson.expenses || []), ...localExpenses],
        income:   [...(fallbackJson.income || []), ...localIncome],
      };
    }
    return { expenses: [], income: [] };
  }

  async function loadFromApi() {
    const rows = await api.listRecords(); // throws if not authed or server down
    return normalizeForDashboard(rows);
  }

  async function loadFromFallback() {
    const resp = await fetch(DATA_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to load data (${resp.status})`);
    const json = await resp.json();
    return normalizeForDashboard([], json);
  }

  async function wireActions(onNewData) {
    const modal = $("#addTxnModal");
    const form = $("#txnForm");
    const btnCancel = $("#btnCancelModal");

    $("#btnUpload")?.addEventListener("click", () => (window.location.href = "./upload.html"));
    $("#btnExport")?.addEventListener("click", () => alert("Exporting CSV…"));

    // Show modal
    $("#btnAddTxn")?.addEventListener("click", () => {
      modal?.classList.remove("hidden");
    });

    // Hide modal
    btnCancel?.addEventListener("click", () => {
      modal?.classList.add("hidden");
    });

    // Handle Save → create via API (fallback to localStorage on failure)
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newTxn = {
        type: ($("#txnType")?.value || "expense").toLowerCase(),
        date: $("#txnDate")?.value,
        source: $("#txnSource")?.value?.trim(),
        category: $("#txnCategory")?.value?.trim(),
        amount: parseFloat($("#txnAmount")?.value),
        method: $("#txnMethod")?.value?.trim(),
        notes: $("#txnNotes")?.value?.trim(),
      };

      try {
        await api.createRecord(newTxn);
      } catch {
        // Fallback to localStorage if API unavailable or user not authed
        const stored = JSON.parse(localStorage.getItem("userTxns") || "[]");
        stored.push(newTxn);
        localStorage.setItem("userTxns", JSON.stringify(stored));
      }

      modal?.classList.add("hidden");
      // Refresh the dashboard with latest data
      await onNewData();
      alert("Transaction added successfully!");
      form.reset();
    });
  }

  async function personalizeWelcome() {
    try {
      const me = await api.me();
      $("#welcomeTitle").textContent = me?.name ? `Welcome back, ${me.name}` : "Welcome back";
      // Optionally expose current user globally if other scripts rely on it:
      window.currentUser = me;
    } catch {
      $("#welcomeTitle").textContent = "Welcome back";
    }
  }

  async function init() {
    await wireActions(refresh);
    await personalizeWelcome();
    await refresh();
  }

  async function refresh() {
    try {
      // Try API first
      const data = await loadFromApi();
      const computed = computeOverview(data);
      renderKpisFromComputed(computed);
      renderExpenses($("#txnTbody"), data.expenses || [], computed.currency);
      const canvas = $("#categoriesChart");
      drawBarChart(canvas, computed.categories || {});
      renderLegend($("#chartLegend"), computed.categories || {});
      renderBreakdown($("#categoryList"), computed.categories || {}, computed.currency);
    } catch (apiErr) {
      console.warn("API unavailable, using fallback:", apiErr?.message || apiErr);
      try {
        const data = await loadFromFallback();
        const computed = computeOverview(data);
        renderKpisFromComputed(computed);
        renderExpenses($("#txnTbody"), data.expenses || [], computed.currency);
        const canvas = $("#categoriesChart");
        drawBarChart(canvas, computed.categories || {});
        renderLegend($("#chartLegend"), computed.categories || {});
        renderBreakdown($("#categoryList"), computed.categories || {}, computed.currency);
      } catch (err) {
        console.error(err);
        $("#lastUpdated").textContent = "Could not load data.";
        $("#txnTbody").innerHTML = `<tr><td colspan="6" class="subtle">Failed to load expenses.</td></tr>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();