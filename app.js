const STORAGE_KEY = "szr-os-v1";
const GITHUB_TOKEN_KEY = "szr-os-github-token";
const GITHUB_OWNER = "romuloyair-lang";
const GITHUB_REPO = "Finanzas-";
const GITHUB_BRANCH = "main";
const GITHUB_DATA_PATH = "data/szr-os-data.json";

const DEFAULT_STATE = {
  transactions: [],
  tasks: [],
  ideas: [],
  daily: { date: "", energy: "", stress: "", nextStep: "" },
  goal: { name: "", target: 0, saved: 0 },
  theme: "dark"
};

const state = Object.assign({}, DEFAULT_STATE, JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
if (!Array.isArray(state.transactions)) state.transactions = [];
if (!Array.isArray(state.tasks)) state.tasks = [];
if (!Array.isArray(state.ideas)) state.ideas = [];
if (!Object.prototype.hasOwnProperty.call(state, "daily")) state.daily = { date: "", energy: "", stress: "", nextStep: "" };
if (!Object.prototype.hasOwnProperty.call(state, "goal")) state.goal = { name: "", target: 0, saved: 0 };
if (!Object.prototype.hasOwnProperty.call(state, "theme")) state.theme = "dark";

const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

function save(sync = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (sync) syncToGithub();
}

function setSyncStatus(text) {
  const label = $("syncStatus");
  if (label) label.textContent = text;
}

function getGithubToken() {
  return localStorage.getItem(GITHUB_TOKEN_KEY) || "";
}

function setGithubHeaders() {
  const token = getGithubToken();
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function encodeBase64Utf8(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64Utf8(text) {
  return decodeURIComponent(escape(atob(text.replace(/\n/g, ""))));
}

let syncTimer = null;
let syncInProgress = false;
let syncQueued = false;

function syncToGithub() {
  if (!getGithubToken()) {
    setSyncStatus("Local");
    return;
  }

  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushGithubData, 900);
}

async function getGithubFile() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}?ref=${GITHUB_BRANCH}`;
  const response = await fetch(url, { headers: setGithubHeaders() });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub respondió ${response.status}`);

  return response.json();
}

async function pushGithubData() {
  if (!getGithubToken()) return;

  if (syncInProgress) {
    syncQueued = true;
    return;
  }

  syncInProgress = true;
  setSyncStatus("Guardando...");

  try {
    const currentFile = await getGithubFile();
    const payload = {
      updatedAt: new Date().toISOString(),
      app: "SZR OS",
      data: state
    };

    const body = {
      message: `Update SZR OS data ${new Date().toISOString()}`,
      content: encodeBase64Utf8(JSON.stringify(payload, null, 2)),
      branch: GITHUB_BRANCH
    };

    if (currentFile?.sha) body.sha = currentFile.sha;

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...setGithubHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`GitHub respondió ${response.status}`);
    setSyncStatus("GitHub actualizado");
  } catch (error) {
    console.error(error);
    setSyncStatus("Error sync");
    alert("No se pudo sincronizar con GitHub. Revisa que el token tenga permiso de Contents: Read and write.");
  } finally {
    syncInProgress = false;
    if (syncQueued) {
      syncQueued = false;
      syncToGithub();
    }
  }
}

async function pullGithubData() {
  if (!getGithubToken()) {
    alert("Primero pega tu GitHub token y presiona Activar sync.");
    return;
  }

  setSyncStatus("Leyendo...");
  try {
    const currentFile = await getGithubFile();
    if (!currentFile?.content) {
      setSyncStatus("Sin archivo");
      return;
    }

    const payload = JSON.parse(decodeBase64Utf8(currentFile.content));
    const remoteState = payload.data || payload;

    Object.assign(state, DEFAULT_STATE, remoteState);
    if (!Array.isArray(state.transactions)) state.transactions = [];
    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.ideas)) state.ideas = [];

    save(false);
    render();
    setSyncStatus("Datos cargados");
  } catch (error) {
    console.error(error);
    setSyncStatus("Error lectura");
    alert("No se pudieron leer los datos desde GitHub.");
  }
}

function setTheme() {
  document.body.classList.toggle("light", state.theme === "light");
}

function setActiveQuickAction(type) {
  document.querySelectorAll(".quick-actions [data-type]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
}

function togglePaymentMethod() {
  const type = document.querySelector('input[name="type"]:checked')?.value;
  const field = $("paymentMethodField");
  if (field) field.style.display = type === "expense" ? "block" : "none";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function renderDailyStatus() {
  const today = todayKey();
  const hasToday = state.daily.date === today;

  $("energyLevel").value = hasToday ? state.daily.energy || "" : "";
  $("stressLevel").value = hasToday ? state.daily.stress || "" : "";
  $("nextStep").value = hasToday ? state.daily.nextStep || "" : "";

  const label = $("dailyStatusLabel");
  if (!hasToday || (!state.daily.energy && !state.daily.stress && !state.daily.nextStep)) {
    label.textContent = "Sin registro";
  } else {
    label.textContent = "Guardado";
  }
}

function renderTasks() {
  const list = $("taskList");
  const pendingTasks = state.tasks.filter(t => !t.done);
  $("taskCountLabel").textContent = `${pendingTasks.length} pendientes`;

  if (!state.tasks.length) {
    list.className = "transaction-list empty";
    list.textContent = "Sin pendientes todavía.";
    return;
  }

  list.className = "transaction-list";
  list.innerHTML = state.tasks.slice().reverse().map(t => `
    <div class="transaction-row">
      <div>
        <strong>${t.done ? "✓ " : ""}${escapeHtml(t.text)}</strong>
        <small>${escapeHtml(t.area)} · ${new Date(t.date).toLocaleDateString("es-MX")}</small>
      </div>
      <button type="button" class="text-button" data-task-id="${t.id}">${t.done ? "Reabrir" : "Hecho"}</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-task-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const task = state.tasks.find(t => t.id === btn.dataset.taskId);
      if (!task) return;
      task.done = !task.done;
      save();
      render();
    });
  });
}

function renderIdeas() {
  const list = $("ideaList");
  $("ideaCountLabel").textContent = `${state.ideas.length} ideas`;

  if (!state.ideas.length) {
    list.className = "transaction-list empty";
    list.textContent = "Sin ideas todavía.";
    return;
  }

  list.className = "transaction-list";
  list.innerHTML = state.ideas.slice().reverse().map(i => `
    <div class="transaction-row">
      <div>
        <strong>${escapeHtml(i.text)}</strong>
        <small>${new Date(i.date).toLocaleDateString("es-MX")}</small>
      </div>
    </div>
  `).join("");
}

function render() {
  setTheme();

  const income = state.transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = state.transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;
  const free = balance - (Number(state.goal.saved) || 0);

  $("balanceAmount").textContent = money(balance);
  $("incomeAmount").textContent = money(income);
  $("expenseAmount").textContent = money(expenses);
  $("freeAmount").textContent = money(free);
  $("todayLabel").textContent = new Date().toLocaleDateString("es-MX", { weekday: "long", month: "short", day: "numeric" });

  $("goalName").value = state.goal.name || "";
  $("goalTarget").value = state.goal.target || "";
  $("goalSaved").value = state.goal.saved || "";

  const pct = state.goal.target > 0 ? Math.min(100, Math.round((state.goal.saved / state.goal.target) * 100)) : 0;
  $("goalBar").style.width = `${pct}%`;
  $("goalProgressLabel").textContent = `${pct}%`;

  const selectedType = document.querySelector('input[name="type"]:checked')?.value || "income";
  setActiveQuickAction(selectedType);
  togglePaymentMethod();
  renderDailyStatus();
  renderTasks();
  renderIdeas();

  const tokenInput = $("githubToken");
  if (tokenInput && getGithubToken() && !tokenInput.value) {
    tokenInput.placeholder = "Token guardado en este navegador";
    setSyncStatus("Sync activo");
  }

  const list = $("transactionList");
  if (!state.transactions.length) {
    list.className = "transaction-list empty";
    list.textContent = "Sin movimientos todavía.";
    return;
  }

  list.className = "transaction-list";
  list.innerHTML = state.transactions.slice().reverse().map(t => {
    const paymentLabel = t.type === "expense" && t.paymentMethod ? (t.paymentMethod === "cash" ? "Efectivo" : "Tarjeta") + " · " : "";
    const typeLabel = t.type === "withdrawal" ? "Retiro · " : "";
    const amountClass = t.type === "income" ? "amount-income" : (t.type === "expense" ? "amount-expense" : "amount-withdrawal");
    const sign = t.type === "income" ? "+" : (t.type === "expense" ? "−" : "");

    return `
      <div class="transaction-row">
        <div>
          <strong>${escapeHtml(t.description)}</strong>
          <small>${typeLabel}${escapeHtml(t.category)} · ${paymentLabel}${new Date(t.date).toLocaleDateString("es-MX")}</small>
        </div>
        <div class="${amountClass}">${sign}${money(t.amount)}</div>
      </div>
    `;
  }).join("");
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
  const paymentMethod = selectedType === "expense" ? $("paymentMethod").value : null;

  if (!description || !amount || amount <= 0) return;

  state.transactions.push({
    id: crypto.randomUUID(),
    type: selectedType,
    amount,
    description,
    category,
    paymentMethod,
    date: new Date().toISOString()
  });

  save();
  $("transactionForm").reset();
  $("typeIncome").checked = true;
  render();
}

$("saveGithubConfig").addEventListener("click", () => {
  const token = $("githubToken").value.trim();
  if (!token) {
    alert("Pega primero tu GitHub token.");
    return;
  }

  localStorage.setItem(GITHUB_TOKEN_KEY, token);
  $("githubToken").value = "";
  $("githubToken").placeholder = "Token guardado en este navegador";
  setSyncStatus("Sync activo");
  pushGithubData();
});

$("pullGithubData").addEventListener("click", pullGithubData);

$("saveDailyStatus").addEventListener("click", () => {
  state.daily = {
    date: todayKey(),
    energy: $("energyLevel").value,
    stress: $("stressLevel").value,
    nextStep: $("nextStep").value.trim()
  };
  save();
  render();
});

$("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("taskText").value.trim();
  if (!text) return;

  state.tasks.push({
    id: crypto.randomUUID(),
    text,
    area: $("taskArea").value,
    done: false,
    date: new Date().toISOString()
  });

  $("taskForm").reset();
  save();
  render();
});

$("ideaForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("ideaText").value.trim();
  if (!text) return;

  state.ideas.push({
    id: crypto.randomUUID(),
    text,
    date: new Date().toISOString()
  });

  $("ideaForm").reset();
  save();
  render();
});

$("transactionForm").addEventListener("submit", (e) => {
  e.preventDefault();
  addTransaction();
});

document.querySelectorAll(".quick-actions [data-type]").forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;

    if (type === "income") $("typeIncome").checked = true;
    if (type === "expense") $("typeExpense").checked = true;
    if (type === "withdrawal") $("typeWithdrawal").checked = true;

    setActiveQuickAction(type);
    togglePaymentMethod();

    $("movementPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("description").focus(), 250);
  });
});

document.querySelectorAll('input[name="type"]').forEach(input => {
  input.addEventListener("change", () => {
    setActiveQuickAction(input.value);
    togglePaymentMethod();
  });
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

$("themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  save();
  render();
});

$("clearBtn").addEventListener("click", () => {
  if (confirm("¿Borrar todos los movimientos, pendientes e ideas?")) {
    state.transactions = [];
    state.tasks = [];
    state.ideas = [];
    save();
    render();
  }
});

$("exportBtn").addEventListener("click", () => {
  const rows = [["date", "type", "description", "category", "paymentMethod", "amount"], ...state.transactions.map(t => [t.date, t.type, t.description, t.category, t.paymentMethod || "", t.amount])];
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "szr-os-finanzas.csv";
  a.click();
  URL.revokeObjectURL(url);
});

render();