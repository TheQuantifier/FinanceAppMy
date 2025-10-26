// web/scripts/records.js
// Handles fetching records, displaying them in tables, filtering,
// and managing Add Expense / Add Income modals.

import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  // =================== Elements ===================
  const expenseTbody = document.getElementById("recordsTbody");
  const incomeTbody = document.getElementById("recordsTbodyIncome");

  const filtersForm = document.getElementById("filtersForm");
  const filtersFormIncome = document.getElementById("filtersFormIncome");

  const expensePageInfo = document.getElementById("pageInfo");
  const incomePageInfo = document.getElementById("pageInfoIncome");

  // Add modals
  const addExpenseModal = document.getElementById("addExpenseModal");
  const addIncomeModal = document.getElementById("addIncomeModal");
  const expenseForm = document.getElementById("expenseForm");
  const incomeForm = document.getElementById("incomeForm");

  // Buttons
  const btnAddExpense = document.getElementById("btnAddExpense");
  const btnAddIncome = document.getElementById("btnAddIncome");
  const cancelExpenseBtn = document.getElementById("cancelExpenseBtn");
  const cancelIncomeBtn = document.getElementById("cancelIncomeBtn");

  // =================== Helpers ===================
  function showModal(modal) {
    modal?.classList.remove("hidden");
  }

  function hideModal(modal) {
    modal?.classList.add("hidden");
  }

  function createRow(record) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${record.date || "—"}</td>
      <td>${record.source || "—"}</td>
      <td>${record.category || "—"}</td>
      <td class="num">${Number(record.amount || 0).toFixed(2)}</td>
      <td>${record.method || "—"}</td>
      <td>${record.notes || ""}</td>
    `;
    return tr;
  }

  // =================== Load Data ===================
  async function loadRecords() {
    try {
      expenseTbody.innerHTML = `<tr><td colspan="6" class="subtle">Loading expenses…</td></tr>`;
      incomeTbody.innerHTML = `<tr><td colspan="6" class="subtle">Loading income…</td></tr>`;

      const [records, receipts] = await Promise.all([
        api.listRecords().catch(() => []),
        api.listReceipts().catch(() => []),
      ]);

      const all = [];

      for (const r of records) {
        all.push({
          date: r.date || "",
          source: r.source || "",
          category: r.category || "",
          amount: Number(r.amount) || 0,
          method: r.method || "",
          notes: r.notes || "",
          type: r.type || "expense",
        });
      }

      for (const r of receipts) {
        all.push({
          date: r.date || "",
          source: r.source || "",
          category: r.category || "",
          amount: Number(r.amount) || 0,
          method: r.method || "",
          notes: r.notes || "",
          type: r.type || (r.amount >= 0 ? "income" : "expense"),
        });
      }

      const expenses = all.filter(r => r.type === "expense");
      const income = all.filter(r => r.type === "income");

      renderTable(expenses, expenseTbody, filtersForm, expensePageInfo);
      renderTable(income, incomeTbody, filtersFormIncome, incomePageInfo);

    } catch (err) {
      console.error("Error loading records:", err);
      if (err.message.toLowerCase().includes("not authenticated")) {
        // Redirect to login with return URL
        const url = new URL("./login.html", location.href);
        url.searchParams.set("redirect", "records.html");
        location.href = url.toString();
        return;
      }

      expenseTbody.innerHTML = `<tr><td colspan="6" class="subtle">Error loading expenses.</td></tr>`;
      incomeTbody.innerHTML = `<tr><td colspan="6" class="subtle">Error loading income.</td></tr>`;
    }
  }

  // =================== Render Tables ===================
  function renderTable(records, tbody, form, pageInfo) {
    if (!form || !tbody) return;

    const q = form.querySelector("input[type=search]")?.value.toLowerCase() || "";
    const category = form.querySelector("select[id^=category]")?.value || "";
    const method = form.querySelector("select[id^=method]")?.value || "";
    const minDate = form.querySelector("input[id^=minDate]")?.value || "";
    const maxDate = form.querySelector("input[id^=maxDate]")?.value || "";
    const minAmt = parseFloat(form.querySelector("input[id^=minAmt]")?.value) || 0;
    const maxAmt = parseFloat(form.querySelector("input[id^=maxAmt]")?.value) || Infinity;
    const sort = form.querySelector("select[id^=sort]")?.value || "";
    const pageSize = parseInt(form.querySelector("select[id^=pageSize]")?.value) || 25;

    let filtered = records.filter(r => {
      const matchQ =
        !q ||
        (r.source && r.source.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q));
      const matchCat = !category || r.category === category;
      const matchMethod = !method || r.method === method;
      const matchDate =
        (!minDate || r.date >= minDate) &&
        (!maxDate || r.date <= maxDate);
      const matchAmt = r.amount >= minAmt && r.amount <= maxAmt;
      return matchQ && matchCat && matchMethod && matchDate && matchAmt;
    });

    filtered.sort((a, b) => {
      switch (sort) {
        case "date_asc": return (a.date || "").localeCompare(b.date || "");
        case "date_desc": return (b.date || "").localeCompare(a.date || "");
        case "amount_asc": return a.amount - b.amount;
        case "amount_desc": return b.amount - a.amount;
        case "source_asc": return (a.source || "").localeCompare(b.source || "");
        case "source_desc": return (b.source || "").localeCompare(a.source || "");
        default: return 0;
      }
    });

    const display = filtered.slice(0, pageSize);
    tbody.innerHTML = "";

    if (display.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="subtle">No matching records.</td></tr>`;
      if (pageInfo) pageInfo.textContent = "Page 1 of 1";
      return;
    }

    display.forEach(r => tbody.appendChild(createRow(r)));

    if (pageInfo) {
      pageInfo.textContent = `Showing ${display.length} of ${filtered.length} record(s)`;
    }
  }

  // =================== Add Expense / Income ===================
  btnAddExpense?.addEventListener("click", () => showModal(addExpenseModal));
  btnAddIncome?.addEventListener("click", () => showModal(addIncomeModal));

  cancelExpenseBtn?.addEventListener("click", () => hideModal(addExpenseModal));
  cancelIncomeBtn?.addEventListener("click", () => hideModal(addIncomeModal));

  expenseForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const payload = {
      type: "expense",
      date: document.getElementById("expenseDate")?.value,
      source: document.getElementById("expenseSource")?.value,
      category: document.getElementById("expenseCategory")?.value,
      amount: parseFloat(document.getElementById("expenseAmount")?.value) || 0,
      method: document.getElementById("expenseMethod")?.value,
      notes: document.getElementById("expenseNotes")?.value,
      currency: "USD",
    };
  
    try {
      await api.createRecord(payload);
      hideModal(addExpenseModal);
      expenseForm.reset();
      await loadRecords();
    } catch (err) {
      if (err.message.toLowerCase().includes("not authenticated")) {
        const url = new URL("./login.html", location.href);
        url.searchParams.set("redirect", "records.html");
        location.href = url.toString();
      } else {
        alert("Error saving expense: " + err.message);
      }
    }
  });
  
  incomeForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const payload = {
      type: "income",
      date: document.getElementById("incomeDate")?.value,
      source: document.getElementById("incomeSource")?.value,
      category: document.getElementById("incomeCategory")?.value,
      amount: parseFloat(document.getElementById("incomeAmount")?.value) || 0,
      method: document.getElementById("incomeMethod")?.value,
      notes: document.getElementById("incomeNotes")?.value,
      currency: "USD",
    };
  
    try {
      await api.createRecord(payload);
      hideModal(addIncomeModal);
      incomeForm.reset();
      await loadRecords();
    } catch (err) {
      if (err.message.toLowerCase().includes("not authenticated")) {
        const url = new URL("./login.html", location.href);
        url.searchParams.set("redirect", "records.html");
        location.href = url.toString();
      } else {
        alert("Error saving income: " + err.message);
      }
    }
  });
  
  // =================== Filter Events ===================
  filtersForm?.addEventListener("submit", e => {
    e.preventDefault();
    loadRecords();
  });
  filtersFormIncome?.addEventListener("submit", e => {
    e.preventDefault();
    loadRecords();
  });

  document.getElementById("btnClear")?.addEventListener("click", () => {
    filtersForm?.reset();
    loadRecords();
  });
  document.getElementById("btnClearIncome")?.addEventListener("click", () => {
    filtersFormIncome?.reset();
    loadRecords();
  });

  // =================== Init ===================
  loadRecords();
});