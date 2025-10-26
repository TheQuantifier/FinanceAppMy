// web/scripts/reports.js
// Computes summary values from live backend data (with fallback to data/sample.json)
// Renders: Doughnut (by category) + Line (income vs expenses over time)

import { api } from "./api.js";

let _catChart = null;
let _lineChart = null;

window.addEventListener("DOMContentLoaded", loadReports);

async function loadReports() {
  try {
    // Try backend first
    const [records, receipts] = await Promise.all([
      api.listRecords().catch(() => []),
      api.listReceipts().catch(() => []),
    ]);

    const normalized = normalizeData(records, receipts);
    const derived = computeSummaryFromRaw(normalized.expenses, normalized.income, normalized.currency);

    updateSummary(derived);
    renderCategoryChart(derived.categories);
    renderIncomeExpenseOverTime(normalized.expenses, normalized.income);
  } catch (apiErr) {
    console.warn("API unavailable, using fallback:", apiErr?.message || apiErr);
    // Fallback to sample JSON
    try {
      const response = await fetch("data/sample.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load report data.");
      const data = await response.json();

      const txns = (data.expenses || []).filter(Boolean);
      const incomes = (data.income || []).filter(Boolean);

      const derived = computeSummaryFromRaw(txns, incomes, data.summary?.currency);
      updateSummary(derived);
      renderCategoryChart(derived.categories);
      renderIncomeExpenseOverTime(txns, incomes);
    } catch (err) {
      console.error("Error loading reports:", err);
      document.querySelectorAll(".card p").forEach(p => (p.textContent = "Error loading data"));
    }
  }
}

/* ===================== Normalization ===================== */

function normalizeData(records = [], receipts = []) {
  const all = [];

  // records from /api/records (already typed)
  for (const r of records) {
    all.push({
      type: (r.type || "expense").toLowerCase(),
      date: r.date || "",
      source: r.source || "",
      category: r.category || "Uncategorized",
      amount: toNumber(r.amount),
      method: r.method || "",
      notes: r.notes || "",
      currency: r.currency || "USD",
    });
  }

  // receipts from /api/receipts (no type → infer by amount sign)
  for (const r of receipts) {
    const amt = toNumber(r.amount);
    all.push({
      type: (amt >= 0 ? "income" : "expense"),
      date: r.date || "",
      source: r.source || "",
      category: r.category || "Uncategorized",
      amount: Math.abs(amt), // treat negative as expense magnitude
      method: r.method || "",
      notes: r.notes || "",
      currency: r.currency || "USD",
    });
  }

  const expenses = all.filter(x => x.type === "expense");
  const income = all.filter(x => x.type === "income");
  const currency = (all[0]?.currency) || "USD";

  return { expenses, income, currency };
}

/* ===================== Derivations ===================== */

function computeSummaryFromRaw(expenses, income, currencyHint) {
  const CURRENCY_FALLBACK = "USD";
  const currency = currencyHint || CURRENCY_FALLBACK;

  const categories = {};
  let total_spending = 0;

  for (const t of expenses) {
    const amt = toNumber(t?.amount);
    total_spending += amt;
    const cat = t?.category || "Uncategorized";
    categories[cat] = (categories[cat] || 0) + amt;
  }

  // Monthly average spending (based on distinct months with expenses)
  const monthsWithSpend = new Set();
  for (const t of expenses) {
    const key = yyyymm(t?.date);
    if (key) monthsWithSpend.add(key);
  }
  const monthCount = Math.max(1, monthsWithSpend.size);
  const monthly_average = total_spending / monthCount;

  // Top category
  const topCategory = getTopCategory(categories);

  return {
    currency,
    total_spending,
    categories,
    monthly_average,
    topCategory,
  };
}

/* ===================== Summary Cards ===================== */

function updateSummary({ currency, total_spending, monthly_average, topCategory }) {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => `$${(toNumber(n)).toFixed(2)} ${currency}`;

  $("total-expenses") && ( $("total-expenses").textContent = fmt(total_spending) );
  $("monthly-average") && ( $("monthly-average").textContent = fmt(monthly_average) );
  $("top-category") && ( $("top-category").textContent = topCategory || "N/A" );
}

function getTopCategory(categories) {
  let top = "N/A";
  let max = 0;
  for (const [category, amount] of Object.entries(categories || {})) {
    if (amount > max) {
      max = amount;
      top = category;
    }
  }
  return top;
}

/* ===================== Charts ===================== */

// Doughnut: Spending by Category
function renderCategoryChart(categories) {
  const ctx = document.getElementById("categoryChart");
  if (!ctx || !window.Chart) return;

  const labels = Object.keys(categories || {});
  const dataVals = Object.values(categories || {});

  // Destroy previous if exists (prevents overlay on re-render)
  if (_catChart) {
    _catChart.destroy();
    _catChart = null;
  }

  _catChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          label: "Spending by Category",
          data: dataVals,
          backgroundColor: ["#007BFF", "#28A745", "#FFC107", "#DC3545", "#6F42C1", "#17A2B8", "#6610f2", "#6c757d"],
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 13 },
          formatter: (value, context) => {
            const arr = context.chart.data.datasets[0].data;
            const total = arr.reduce((s, v) => s + toNumber(v), 0);
            if (!total) return "0%";
            const pct = ((value / total) * 100).toFixed(1);
            return pct + "%";
          },
        },
      },
    },
    plugins: [window.ChartDataLabels].filter(Boolean),
  });
}

// Line: Income & Expenses Over Time (sum by day)
function renderIncomeExpenseOverTime(expenses, income) {
  const ctx = document.getElementById("monthlyChart");
  if (!ctx || !window.Chart) return;

  const expenseByDate = sumByDate(expenses);
  const incomeByDate = sumByDate(income);

  const labels = Array.from(new Set([...Object.keys(expenseByDate), ...Object.keys(incomeByDate)]))
    .filter(Boolean)
    .sort();

  const expenseData = labels.map(d => toNumber(expenseByDate[d]));
  const incomeData = labels.map(d => toNumber(incomeByDate[d]));

  // Destroy previous
  if (_lineChart) {
    _lineChart.destroy();
    _lineChart = null;
  }

  _lineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses ($)",
          data: expenseData,
          borderColor: "#DC3545",
          backgroundColor: "rgba(220, 53, 69, 0.2)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "Income ($)",
          data: incomeData,
          borderColor: "#28A745",
          backgroundColor: "rgba(40, 167, 69, 0.2)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: $${(toNumber(ctx.parsed.y)).toFixed(2)}`
          }
        }
      },
    },
  });

  // Checkbox toggles
  const expToggle = document.getElementById("toggle-expenses");
  const incToggle = document.getElementById("toggle-income");

  if (expToggle) {
    _lineChart.data.datasets[0].hidden = !expToggle.checked;
    expToggle.addEventListener("change", () => {
      _lineChart.data.datasets[0].hidden = !expToggle.checked;
      _lineChart.update("none");
    });
  }

  if (incToggle) {
    _lineChart.data.datasets[1].hidden = !incToggle.checked;
    incToggle.addEventListener("change", () => {
      _lineChart.data.datasets[1].hidden = !incToggle.checked;
      _lineChart.update("none");
    });
  }
}

/* ===================== Helpers ===================== */

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// return "YYYY-MM" or null if invalid
function yyyymm(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// Sum amounts by exact ISO date key "YYYY-MM-DD"
function sumByDate(rows) {
  const map = {};
  for (const r of rows || []) {
    const d = normalizeDateKey(r?.date);
    if (!d) continue;
    map[d] = (map[d] || 0) + toNumber(r?.amount);
  }
  return map;
}

// Normalize to "YYYY-MM-DD" if possible, else null
function normalizeDateKey(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return iso;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(date)) return null;
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}