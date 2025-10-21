// reports.js
// Dynamically loads report data from /data/sample.json and generates charts
// Now computes all summary values from raw arrays (no summary object required).

async function loadReports() {
  try {
    const response = await fetch("data/sample.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load report data.");

    const data = await response.json();

    const txns = (data.expenses || []).filter(Boolean);
    const incomes = (data.income || []).filter(Boolean);

    const derived = computeSummaryFromRaw(txns, incomes, data.summary?.currency);

    // Populate summary cards
    updateSummary(derived);

    // Generate charts
    renderCategoryChart(derived.categories);
    renderIncomeExpenseOverTime(txns, incomes);

  } catch (error) {
    console.error("Error loading reports:", error);
    document.querySelectorAll(".card p").forEach(p => (p.textContent = "Error loading data"));
  }
}

// ========== Derivations from raw data ==========

function computeSummaryFromRaw(expenses, income, currencyHint) {
  const CURRENCY_FALLBACK = "USD";
  const currency = currencyHint || CURRENCY_FALLBACK;

  // 1) Total spending and category sums from expenses
  const categories = {};
  let total_spending = 0;

  for (const t of expenses) {
    const amt = toNumber(t?.amount);
    total_spending += amt;
    const cat = t?.category || "Uncategorized";
    categories[cat] = (categories[cat] || 0) + amt;
  }

  // 2) Monthly average spending (based on months that have at least one expense)
  //    Fallback to simple average across categories if no month info found.
  const monthsWithSpend = new Set();
  for (const t of expenses) {
    const key = yyyymm(t?.date);
    if (key) monthsWithSpend.add(key);
  }
  const monthCount = Math.max(1, monthsWithSpend.size);
  const monthly_average = total_spending / monthCount;

  // 3) Top category
  const topCategory = getTopCategory(categories);

  return {
    currency,
    total_spending,
    categories,
    monthly_average,
    topCategory
  };
}

// ========== Summary Section ==========

function updateSummary(derived) {
  const { currency, total_spending, categories, monthly_average, topCategory } = derived;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => `$${(toNumber(n)).toFixed(2)} ${currency}`;

  $("total-expenses").textContent = fmt(total_spending);
  $("monthly-average").textContent = fmt(monthly_average);
  $("top-category").textContent = topCategory || "N/A";
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

// ========== Charts ==========

// Chart 1: Spending by Category (with percentage labels)
function renderCategoryChart(categories) {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;

  const labels = Object.keys(categories || {});
  const dataVals = Object.values(categories || {});

  new Chart(ctx, {
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
    plugins: [ChartDataLabels],
  });
}

// Chart 2: Income & Expenses Over Time (sums by day, with toggles)
function renderIncomeExpenseOverTime(expenses, income) {
  const ctx = document.getElementById("monthlyChart");
  if (!ctx) return;

  // Sum by ISO date (YYYY-MM-DD). Missing/invalid dates get ignored.
  const expenseByDate = sumByDate(expenses);
  const incomeByDate = sumByDate(income);

  // Union of all dates
  const labels = Array.from(new Set([...Object.keys(expenseByDate), ...Object.keys(incomeByDate)]))
    .filter(Boolean)
    .sort();

  const expenseData = labels.map(d => toNumber(expenseByDate[d]));
  const incomeData = labels.map(d => toNumber(incomeByDate[d]));

  const chart = new Chart(ctx, {
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
      scales: {
        y: { beginAtZero: true },
      },
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

  // === Checkboxes for toggling ===
  const expToggle = document.getElementById("toggle-expenses");
  const incToggle = document.getElementById("toggle-income");

  if (expToggle) {
    chart.data.datasets[0].hidden = !expToggle.checked;
    expToggle.addEventListener("change", () => {
      chart.data.datasets[0].hidden = !expToggle.checked;
      chart.update("none");
    });
  }

  if (incToggle) {
    chart.data.datasets[1].hidden = !incToggle.checked;
    incToggle.addEventListener("change", () => {
      chart.data.datasets[1].hidden = !incToggle.checked;
      chart.update("none");
    });
  }
}

// ========== Helpers ==========

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// return "YYYY-MM" or null if invalid
function yyyymm(iso) {
  if (!iso || typeof iso !== "string") return null;
  // Accept "YYYY-MM" or "YYYY-MM-DD"
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
  // If provided as "YYYY-MM", skip (we chart daily)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return iso;
  // Try to parse a Date; if valid, reformat to YYYY-MM-DD
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(date)) return null;
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

window.addEventListener("DOMContentLoaded", loadReports);
