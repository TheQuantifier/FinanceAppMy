// frontend/records.js
// ========== RECORDS PAGE LOGIC (Expenses + Income; header/footer handled by default.js) ==========
(() => {
  // Use the receipts endpoint (returns an array of Receipt documents)
  const DATA_URL = "http://localhost:4000/receipts";
  // POST new manual transactions to the records router (mounted at /records)
  const POST_URL = "http://localhost:4000/records";
  const CURRENCY_FALLBACK = "USD";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const fmtMoney = (value, currency) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: currency || CURRENCY_FALLBACK }).format(value ?? 0);

  const fmtDate = (isoOrStr) => {
    if (!isoOrStr) return "";
    // Try to parse common formats (YYYY-MM-DD or MM/DD/YYYY). If it's already ISO, Date will handle it.
    try {
      // Normalize: accept "MM/DD/YYYY" and "YYYY-MM-DD"
      const d = parseDate(isoOrStr);
      if (!d || Number.isNaN(d.getTime())) return String(isoOrStr);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return String(isoOrStr);
    }
  };

  // ---- Data
  let EXP_RAW = [];
  let INC_RAW = [];
  let summaryCurrency = CURRENCY_FALLBACK;

  // Robust date parser: accept YYYY-MM-DD and MM/DD/YYYY
  function parseDate(s) {
    if (!s) return null;
    if (s instanceof Date) return s;
    const trimmed = String(s).trim();
    // YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    // MM/DD/YYYY or M/D/YYYY
    const mdMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdMatch) {
      const mm = mdMatch[1].padStart(2, "0");
      const dd = mdMatch[2].padStart(2, "0");
      const yyyy = mdMatch[3];
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    // fallback - let Date try (may be locale dependent)
    const d = new Date(trimmed);
    return isNaN(d) ? null : d;
  }

  // ----------------- LOAD DATA -----------------
  async function loadData() {
    const resp = await fetch(DATA_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to load data (${resp.status})`);
    const json = await resp.json();
    
    console.log("Fetched JSON", json);
    // The backend returns a flat array, so split manually if needed
    EXP_RAW = json.filter(r => r.type === "expense");
    INC_RAW = json.filter(r => r.type === "income");
  
    // If no type field exists, assume all are expenses
    if (!EXP_RAW.length && !INC_RAW.length) {
      EXP_RAW = json;
    }
  
    summaryCurrency = json[0]?.currency || CURRENCY_FALLBACK;
  
    // Pass json here
    hydrateCategoryFilters(json);
  }

  function hydrateCategoryFilters() {
    const expSel = $("#category");
    if (expSel) {
      // Clear existing options
      expSel.innerHTML = `<option value="">All</option>`;
      const expCats = Array.from(new Set(EXP_RAW.map(t => (t.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      for (const name of expCats) {
        const opt = document.createElement("option");
        opt.value = name; opt.textContent = name;
        expSel.appendChild(opt);
      }
    }

    const incSel = $("#categoryIncome");
    if (incSel) {
      incSel.innerHTML = `<option value="">All</option>`;
      const incCats = Array.from(new Set(INC_RAW.map(t => (t.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      for (const name of incCats) {
        const opt = document.createElement("option");
        opt.value = name; opt.textContent = name;
        incSel.appendChild(opt);
      }
    }
  }

  // ----------------- CONTROLLER FACTORY -----------------
  function makeController(cfg) {
    const els = {
      q: $(`#${cfg.prefix === "exp" ? "q" : "qIncome"}`),
      category: $(`#${cfg.prefix === "exp" ? "category" : "categoryIncome"}`),
      method: $(`#${cfg.prefix === "exp" ? "method" : "methodIncome"}`),
      minDate: $(`#${cfg.prefix === "exp" ? "minDate" : "minDateIncome"}`),
      maxDate: $(`#${cfg.prefix === "exp" ? "maxDate" : "maxDateIncome"}`),
      minAmt: $(`#${cfg.prefix === "exp" ? "minAmt" : "minAmtIncome"}`),
      maxAmt: $(`#${cfg.prefix === "exp" ? "maxAmt" : "maxAmtIncome"}`),
      sort: $(`#${cfg.prefix === "exp" ? "sort" : "sortIncome"}`),
      pageSize: $(`#${cfg.prefix === "exp" ? "pageSize" : "pageSizeIncome"}`),
      form: $(`#${cfg.prefix === "exp" ? "filtersForm" : "filtersFormIncome"}`),
      btnClear: $(`#${cfg.prefix === "exp" ? "btnClear" : "btnClearIncome"}`),
      tbody: $(`#${cfg.prefix === "exp" ? "recordsTbody" : "recordsTbodyIncome"}`),
      prevPage: $(`#${cfg.prefix === "exp" ? "prevPage" : "prevPageIncome"}`),
      nextPage: $(`#${cfg.prefix === "exp" ? "nextPage" : "nextPageIncome"}`),
      pageInfo: $(`#${cfg.prefix === "exp" ? "pageInfo" : "pageInfoIncome"}`),
      btnExport: $(`#${cfg.prefix === "exp" ? "btnExportExpenses" : "btnExportIncome"}`),
    };

    const state = {
      q: "", category: "", method: "",
      minDate: "", maxDate: "",
      minAmt: "", maxAmt: "",
      sort: "date_desc",
      page: 1,
      pageSize: 25,
    };

    function matchesText(txn, q) {
      if (!q) return true;
      const t = q.toLowerCase();
      return cfg.textFields.some(f => (String(txn[f] || "").toLowerCase().includes(t)));
    }

    function withinDate(txn, minDate, maxDate) {
      if (!minDate && !maxDate) return true;
      const d = parseDate(txn.date);
      if (!d) return false;
      if (minDate) {
        const md = parseDate(minDate);
        if (md && d < md) return false;
      }
      if (maxDate) {
        const xd = parseDate(maxDate);
        if (xd && d > xd) return false;
      }
      return true;
    }

    function withinAmount(txn, minAmt, maxAmt) {
      const a = Number(txn.amount) || 0;
      if (minAmt !== "" && minAmt != null && !Number.isNaN(Number(minAmt)) && a < Number(minAmt)) return false;
      if (maxAmt !== "" && maxAmt != null && !Number.isNaN(Number(maxAmt)) && a > Number(maxAmt)) return false;
      return true;
    }

    function applyFilters() {
      let list = cfg.rows().slice();
      list = list.filter(txn =>
        matchesText(txn, state.q) &&
        (!state.category || (txn.category || "") === state.category) &&
        (
          !state.method ||
          (
            state.method.toLowerCase() === "other"
              ? !["cash", "credit card", "debit card", "direct deposit", "ach", "check", "paypal"].includes(((txn.method || "")).toLowerCase())
              : (txn.method || "").toLowerCase() === state.method.toLowerCase()
          )
        ) &&
        withinDate(txn, state.minDate, state.maxDate) &&
        withinAmount(txn, state.minAmt, state.maxAmt)
      );

      list.sort((a, b) => {
        switch (state.sort) {
          case "date_asc": return (a.date || "").localeCompare(b.date || "");
          case "date_desc": return (b.date || "").localeCompare(a.date || "");
          case "amount_asc": return (Number(a.amount) || 0) - (Number(b.amount) || 0);
          case "amount_desc": return (Number(b.amount) || 0) - (Number(a.amount) || 0);
          case "source_asc": return (a[cfg.sortKeys.alpha] || "").localeCompare(b[cfg.sortKeys.alpha] || "");
          case "source_desc": return (b[cfg.sortKeys.alpha] || "").localeCompare(a[cfg.sortKeys.alpha] || "");
          default: return 0;
        }
      });
      return list;
    }

    function paginate(list) {
      const size = Number(state.pageSize) || 25;
      const pages = Math.max(1, Math.ceil(list.length / size));
      const page = Math.min(Math.max(1, state.page), pages);
      const start = (page - 1) * size;
      return { slice: list.slice(start, start + size), page, pages, total: list.length };
    }

    function renderTable(rows) {
      const tb = els.tbody;
      if (!tb) return;
      tb.innerHTML = "";
      if (!rows.length) {
        tb.innerHTML = `<tr><td colspan="6" class="subtle">No results.</td></tr>`;
        return;
      }
      for (const txn of rows) {
        const tr = document.createElement("tr");
        tr.innerHTML = cfg.columns(txn);
        tb.appendChild(tr);
      }
    }

    function renderPager(info) {
      if (els.pageInfo) els.pageInfo.textContent =
        `Page ${info.page} of ${info.pages} — ${info.total} result${info.total === 1 ? "" : "s"}`;
      if (els.prevPage) els.prevPage.disabled = info.page <= 1;
      if (els.nextPage) els.nextPage.disabled = info.page >= info.pages;
    }

    function updateView() {
      const filtered = applyFilters();
      const info = paginate(filtered);
      renderTable(info.slice);
      renderPager(info);
    }

    function readForm() {
      state.q = els.q?.value.trim() || "";
      state.category = els.category?.value || "";
      state.method = els.method?.value || "";
      state.minDate = els.minDate?.value || "";
      state.maxDate = els.maxDate?.value || "";
      state.minAmt = els.minAmt?.value || "";
      state.maxAmt = els.maxAmt?.value || "";
      state.sort = els.sort?.value || "date_desc";
      state.pageSize = Number(els.pageSize?.value) || 25;
      state.page = 1;
    }

    function exportCSV() {
      const filtered = applyFilters();
      const header = ["Date", "Source", "Category", "Amount", "Method", "Notes"];
      const lines = [header.join(",")];
      for (const t of filtered) {
        const row = [
          t.date || "",
          (t[cfg.sortKeys.alpha] || "").replace(/"/g, '""'),
          (t.category || "").replace(/"/g, '""'),
          (Number(t.amount) ?? 0).toFixed(2),
          (t.method || "").replace(/"/g, '""'),
          (t.notes || "").replace(/"/g, '""'),
        ].map(v => /[",\n]/.test(v) ? `"${v}"` : String(v));
        lines.push(row.join(","));
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `${cfg.prefix === "exp" ? "expenses" : "income"}-${new Date().toISOString().slice(0,10)}.csv`,
      });
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }

    function wire() {
      els.form?.addEventListener("submit", (e) => { e.preventDefault(); readForm(); updateView(); });
      els.btnClear?.addEventListener("click", () => {
        $$("#" + els.form.id + " input, #" + els.form.id + " select").forEach(el => {
          if (el === els.pageSize) return;
          if (el.tagName === "SELECT") el.selectedIndex = 0;
          else el.value = "";
        });
        readForm();
        updateView();
      });
      els.q?.addEventListener("input", () => { readForm(); updateView(); });
      els.sort?.addEventListener("change", () => { readForm(); updateView(); });
      els.pageSize?.addEventListener("change", () => { readForm(); updateView(); });
      els.prevPage?.addEventListener("click", () => { state.page = Math.max(1, state.page - 1); updateView(); });
      els.nextPage?.addEventListener("click", () => { state.page = state.page + 1; updateView(); });
      els.btnExport?.addEventListener("click", exportCSV);
    }

    return { wire, updateView, readForm };
  }

  // ----------------- MODALS -----------------
  function wireModals() {
    const modals = {
      expense: $("#addExpenseModal"),
      income: $("#addIncomeModal")
    };

    const forms = {
      expense: $("#expenseForm"),
      income: $("#incomeForm")
    };

    // Open modals
    $("#btnAddExpense")?.addEventListener("click", () => modals.expense.classList.remove("hidden"));
    $("#btnAddIncome")?.addEventListener("click", () => modals.income.classList.remove("hidden"));

    // Cancel buttons
    $("#cancelExpenseBtn")?.addEventListener("click", () => modals.expense.classList.add("hidden"));
    $("#cancelIncomeBtn")?.addEventListener("click", () => modals.income.classList.add("hidden"));

    // Save to backend
    async function saveTransaction(txn) {
      // Validate amount as number so server accepts it
      if (typeof txn.amount !== "number") txn.amount = parseFloat(txn.amount) || 0;
      const resp = await fetch(POST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txn)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({error:"save failed"}));
        throw new Error(err?.error || `Save failed (${resp.status})`);
      }
      // reload from DB
      await loadData();
    }

    forms.expense?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const txn = {
        type: "expense",
        date: $("#expenseDate").value,
        source: $("#expenseSource").value,
        category: $("#expenseCategory").value,
        amount: parseFloat($("#expenseAmount").value) || 0,
        method: $("#expenseMethod").value,
        notes: $("#expenseNotes").value
      };
      try {
        await saveTransaction(txn);
        modals.expense.classList.add("hidden");
        forms.expense.reset();
        alert("Expense added!");
      } catch (err) {
        console.error(err);
        alert("Failed to save expense: " + err.message);
      }
    });

    forms.income?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const txn = {
        type: "income",
        date: $("#incomeDate").value,
        source: $("#incomeSource").value,
        category: $("#incomeCategory").value,
        amount: parseFloat($("#incomeAmount").value) || 0,
        method: $("#incomeMethod").value,
        notes: $("#incomeNotes").value
      };
      try {
        await saveTransaction(txn);
        modals.income.classList.add("hidden");
        forms.income.reset();
        alert("Income added!");
      } catch (err) {
        console.error(err);
        alert("Failed to save income: " + err.message);
      }
    });
  }

  // ----------------- INIT -----------------
  async function init() {
    wireModals();

    try {
      await loadData();

      const expensesCtrl = makeController({
        prefix: "exp",
        rows: () => EXP_RAW,
        textFields: ["source", "category", "notes"],
        sortKeys: { alpha: "source" },
        columns: (t) => `
          <td>${fmtDate(t.date)}</td>
          <td>${t.source || ""}</td>
          <td>${t.category || ""}</td>
          <td class="num">${fmtMoney(t.amount, summaryCurrency)}</td>
          <td>${t.method || ""}</td>
          <td>${t.notes || ""}</td>
        `
      });

      const incomeCtrl = makeController({
        prefix: "inc",
        rows: () => INC_RAW,
        textFields: ["source", "category", "notes"],
        sortKeys: { alpha: "source" },
        columns: (t) => `
          <td>${fmtDate(t.date)}</td>
          <td>${t.source || ""}</td>
          <td>${t.category || ""}</td>
          <td class="num">${fmtMoney(t.amount, summaryCurrency)}</td>
          <td>${t.method || ""}</td>
          <td>${t.notes || ""}</td>
        `
      });

      expensesCtrl.wire();
      incomeCtrl.wire();
      expensesCtrl.readForm();
      incomeCtrl.readForm();
      expensesCtrl.updateView();
      incomeCtrl.updateView();
    } catch (err) {
      console.error(err);
      const tb1 = $("#recordsTbody");
      const tb2 = $("#recordsTbodyIncome");
      if (tb1) tb1.innerHTML = `<tr><td colspan="6" class="subtle">Failed to load data.</td></tr>`;
      if (tb2) tb2.innerHTML = `<tr><td colspan="6" class="subtle">Failed to load data.</td></tr>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
