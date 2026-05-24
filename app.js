const STORAGE_KEY = "szr-finance-v2";

const state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  transactions: [],
  goal: { name: "", target: 0, saved: 0 },
  bank: { cash: 0, creditLimit: 0, creditUsed: 0 },
  theme: "dark",
  notes: ""
};

if (!Object.prototype.hasOwnProperty.call(state, "notes")) {
  state.notes = "";
}

if (!Object.prototype.hasOwnProperty.call(state, "bank")) {
  state.bank = { cash: 0, creditLimit: 0, creditUsed: 0 };
}

const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setTheme() {
  document.body.classList.toggle("light", state.theme === "light");
}

function setActiveQuickAction(type) {
  document.querySelectorAll(".quick-actions [data-type]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
}

function render() {
  setTheme();

  const income = state.transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = state.transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;
  const free = balance - (Number(state.goal.saved) || 0);

  const cash = Number(state.bank.cash) || 0;
  const creditLimit = Number(state.bank.creditLimit) || 0;
  const creditUsed = Number(state.bank.creditUsed) || 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const totalAvailable = cash + creditAvailable;

  $("balanceAmount").textContent = money(balance);
  $("incomeAmount").textContent = money(income);
  $("expenseAmount").textContent = money(expenses);
  $("freeAmount").textContent = money(free);

  $("cashAvailableAmount").textContent = money(cash);
  $("creditAvailableAmount").textContent = money(creditAvailable);
  $("totalBankAvailableAmount").textContent = money(totalAvailable);

  $("bankCash").value = cash || "";
  $("creditLimit").value = creditLimit || "";
  $("creditUsed").value = creditUsed || "";

  $("todayLabel").textContent = new Date().toLocaleDateString("es-MX", { weekday: "long", month: "short", day: "numeric" });

  $("goalName").value = state.goal.name || "";
  $("goalTarget").value = state.goal.target || "";
  $("goalSaved").value = state.goal.saved || "";

  const notesBox = $("changeNotes");
  if (notesBox) notesBox.value = state.notes || "";

  const pct = state.goal.target > 0 ? Math.min(100, Math.round((state.goal.saved / state.goal.target) * 100)) : 0;
  $("goalBar").style.width = `${pct}%`;
  $("goalProgressLabel").textContent = `${pct}%`;

  const selectedType = document.querySelector('input[name="type"]:checked')?.value || "income";
  setActiveQuickAction(selectedType);

  const list = $("transactionList");
  if (!state.transactions.length) {
    list.className = "transaction-list empty";
    list.textContent = "Sin movimientos todavía.";
    return;
  }

  list.className = "transaction-list";
  list.innerHTML = state.transactions.slice().reverse().map(t => `
    <div class="transaction-row">
      <div>
        <strong>${escapeHtml(t.description)}</strong>
        <small>${escapeHtml(t.category)} · ${new Date(t.date).toLocaleDateString("es-MX")}</small>
      </div>
      <div class="${t.type === "income" ? "amount-income" : "amount-expense"}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</div>
    </div>
  `).join("");
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[c]));
}

function addTransaction(type = null) {
  const selectedType = type || document.querySelector('input[name="type"]:checked').value;
  const amount = Number($("amount").value);
  const description = $("description").value.trim();
  const category = $("category").value;

  if (!description || !amount || amount <= 0) return;

  state.transactions.push({
    id: crypto.randomUUID(),
    type: selectedType,
    amount,
    description,
    category,
    date: new Date().toISOString()
  });

  save();
  $("transactionForm").reset();
  $("typeIncome").checked = true;
  render();
}

$("transactionForm").addEventListener("submit", (e) => {
  e.preventDefault();
  addTransaction();
});

document.querySelectorAll(".quick-actions [data-type]").forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    document.querySelector(`#type${type === "income" ? "Income" : "Expense"}`).checked = true;
    setActiveQuickAction(type);
    $("movementPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("description").focus(), 250);
  });
});

document.querySelectorAll('input[name="type"]').forEach(input => {
  input.addEventListener("change", () => setActiveQuickAction(input.value));
});

$("saveGoal").addEventListener("click", () => {
  state.goal = {
    name: $("goalName").value.trim(),
    target: Number($("goalTarget").value) || 0,
    saved: Number($("goalSaved").value) || 0
  };

  save();
  render();
});

$("saveBank").addEventListener("click", () => {
  state.bank = {
    cash: Number($("bankCash").value) || 0,
    creditLimit: Number($("creditLimit").value) || 0,
    creditUsed: Number($("creditUsed").value) || 0
  };

  save();
  render();
});

const saveChangeNotesButton = $("saveChangeNotes");
if (saveChangeNotesButton) {
  saveChangeNotesButton.addEventListener("click", () => {
    state.notes = $("changeNotes").value.trim();
    save();
    saveChangeNotesButton.textContent = "Notas guardadas";
    setTimeout(() => saveChangeNotesButton.textContent = "Guardar notas", 1400);
  });
}

$("themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  save();
  render();
});

$("clearBtn").addEventListener("click", () => {
  if (confirm("¿Borrar todos los movimientos?")) {
    state.transactions = [];
    save();
    render();
  }
});

$("exportBtn").addEventListener("click", () => {
  const rows = [["date", "type", "description", "category", "amount"], ...state.transactions.map(t => [t.date, t.type, t.description, t.category, t.amount])];
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "szr-finanzas.csv";
  a.click();
  URL.revokeObjectURL(url);
});

render();