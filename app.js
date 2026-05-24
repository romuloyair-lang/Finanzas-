const STORAGE_KEY = "yair-os-v2";
const GITHUB_TOKEN_KEY = "yair-os-github-token";
const GOOGLE_SCRIPT_URL_KEY = "yair-os-google-script-url";
const OPENAI_PROXY_URL_KEY = "yair-os-openai-proxy-url";

const GITHUB_OWNER = "romuloyair-lang";
const GITHUB_REPO = "Finanzas-";
const GITHUB_BRANCH = "main";
const GITHUB_DATA_PATH = "data/yair-os-data.json";

const DEFAULT_STATE = {
  transactions: [],
  tasks: [],
  memories: [],
  theme: "dark"
};

const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
const state = {
  ...DEFAULT_STATE,
  ...savedState,
  transactions: Array.isArray(savedState.transactions) ? savedState.transactions : [],
  tasks: Array.isArray(savedState.tasks) ? savedState.tasks : [],
  memories: Array.isArray(savedState.memories) ? savedState.memories : []
};

const $ = (id) => document.getElementById(id);
const exists = (id) => Boolean($(id));
const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);
const todayKey = () => new Date().toISOString().slice(0, 10);

function safeUUID() {
  return crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function save(sync = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (sync) syncToGithub();
}

function getGithubToken() {
  return localStorage.getItem(GITHUB_TOKEN_KEY) || "";
}

function getGoogleScriptUrl() {
  return localStorage.getItem(GOOGLE_SCRIPT_URL_KEY) || "";
}

function getOpenAiProxyUrl() {
  return localStorage.getItem(OPENAI_PROXY_URL_KEY) || "";
}

function setSyncStatus(text) {
  if (exists("syncStatus")) $("syncStatus").textContent = text;
}

function setTheme() {
  document.body.classList.toggle("light", state.theme === "light");
}

function setActiveQuickAction(type) {
  document.querySelectorAll(".quick-actions [data-type]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
}

function togglePaymentMethod() {
  const type = document.querySelector('input[name="type"]:checked')?.value;
  if (exists("paymentMethodField")) $("paymentMethodField").style.display = type === "expense" ? "block" : "none";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[c]));
}

function encodeBase64Utf8(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64Utf8(text) {
  return decodeURIComponent(escape(atob(text.replace(/\n/g, ""))));
}

function githubHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${getGithubToken()}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
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
  const response = await fetch(url, { headers: githubHeaders() });
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
      app: "Yair OS",
      source: "GitHub Pages",
      data: state
    };

    const body = {
      message: `Update Yair OS data ${new Date().toISOString()}`,
      content: encodeBase64Utf8(JSON.stringify(payload, null, 2)),
      branch: GITHUB_BRANCH
    };

    if (currentFile?.sha) body.sha = currentFile.sha;

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`GitHub respondió ${response.status}`);
    setSyncStatus("GitHub actualizado");
  } catch (error) {
    console.error(error);
    setSyncStatus("Error GitHub");
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
    alert("Primero pega tu GitHub token y presiona Activar sync GitHub.");
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
    state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
    state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
    state.memories = Array.isArray(state.memories) ? state.memories : [];
    save(false);
    render();
    setSyncStatus("Datos cargados");
  } catch (error) {
    console.error(error);
    setSyncStatus("Error lectura");
    alert("No se pudieron leer los datos desde GitHub.");
  }
}

async function sendToGoogle(action, payload) {
  const scriptUrl = getGoogleScriptUrl();
  if (!scriptUrl) return { skipped: true };

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload, app: "Yair OS", createdAt: new Date().toISOString() })
    });
    return { success: true, response };
  } catch (error) {
    console.error(error);
    return { success: false, error };
  }
}

async function askOpenAi() {
  const proxyUrl = getOpenAiProxyUrl();
  const prompt = $("aiPrompt")?.value.trim();
  const answer = $("aiAnswer");

  if (!answer) return;
  if (!proxyUrl) {
    answer.className = "ai-answer empty";
    answer.textContent = "Primero configura el OpenAI proxy URL.";
    return;
  }
  if (!prompt) {
    answer.className = "ai-answer empty";
    answer.textContent = "Escribe una pregunta para tu sistema.";
    return;
  }

  answer.className = "ai-answer";
  answer.textContent = "Analizando...";

  const context = {
    transactions: state.transactions.slice(-50),
    tasks: state.tasks.slice(-30),
    memories: state.memories.slice(-30),
    totals: getTotals()
  };

  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, context })
    });

    if (!response.ok) throw new Error(`Proxy respondió ${response.status}`);
    const data = await response.json();
    answer.textContent = data.answer || data.text || "Sin respuesta.";
  } catch (error) {
    console.error(error);
    answer.className = "ai-answer empty";
    answer.textContent = "No se pudo consultar OpenAI. Revisa el proxy URL.";
  }
}

function getTotals() {
  const income = state.transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenses = state.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
  const withdrawals = state.transactions.filter((t) => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount || 0), 0);
  return { income, expenses, withdrawals, balance: income - expenses - withdrawals };
}

async function addTransaction() {
  const selectedType = document.querySelector('input[name="type"]:checked')?.value || "income";
  const amount = Number($("amount")?.value || 0);
  const description = $("description")?.value.trim();
  const category = $("category")?.value || "Otro";
  const paymentMethod = selectedType === "expense" ? $("paymentMethod")?.value || "" : "";

  if (!description || !amount || amount <= 0) return;

  const transaction = {
    id: safeUUID(),
    type: selectedType,
    amount,
    description,
    category,
    paymentMethod,
    date: new Date().toISOString()
  };

  state.transactions.push(transaction);
  save();
  await sendToGoogle("transaction", transaction);
  $("transactionForm")?.reset();
  if (exists("typeIncome")) $("typeIncome").checked = true;
  render();
}

async function addMemory(event) {
  event.preventDefault();
  const text = $("memoryText")?.value.trim();
  if (!text) return;

  const memory = {
    id: safeUUID(),
    date: new Date().toISOString(),
    category: $("memoryCategory")?.value || "Personal",
    text,
    priority: "Media",
    status: "Activo",
    source: "Yair OS App"
  };

  state.memories.push(memory);
  save();
  await sendToGoogle("memory", memory);
  $("memoryForm")?.reset();
  render();
}

async function addTask(event) {
  event.preventDefault();
  const text = $("taskText")?.value.trim();
  if (!text) return;

  const task = {
    id: safeUUID(),
    text,
    area: $("taskArea")?.value || "Personal",
    targetDate: $("taskDate")?.value || "",
    done: false,
    date: new Date().toISOString()
  };

  state.tasks.push(task);
  save();
  await sendToGoogle("task", task);
  $("taskForm")?.reset();
  render();
}

function renderTasks() {
  const list = $("taskList");
  if (!list) return;

  const pendingTasks = state.tasks.filter((t) => !t.done);
  if (exists("taskCountLabel")) $("taskCountLabel").textContent = `${pendingTasks.length} pendientes`;

  if (!state.tasks.length) {
    list.className = "transaction-list empty";
    list.textContent = "Sin pendientes todavía.";
    return;
  }

  list.className = "transaction-list";
  list.innerHTML = state.tasks.slice().reverse().map((t) => `
    <div class="transaction-row">
      <div>
        <strong>${t.done ? "✓ " : ""}${escapeHtml(t.text)}</strong>
        <small>${escapeHtml(t.area)}${t.targetDate ? " · " + escapeHtml(t.targetDate) : ""}</small>
      </div>
      <button type="button" class="text-button" data-task-id="${t.id}">${t.done ? "Reabrir" : "Hecho"}</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-task-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const task = state.tasks.find((t) => t.id === btn.dataset.taskId);
      if (!task) return;
      task.done = !task.done;
      save();
      sendToGoogle("task", task);
      render();
    });
  });
}

function renderTransactions() {
  const list = $("transactionList");
  if (!list) return;

  if (!state.transactions.length) {
    list.className = "transaction-list empty";
    list.textContent = "Sin movimientos todavía.";
    return;
  }

  list.className = "transaction-list";
  list.innerHTML = state.transactions.slice().reverse().map((t) => {
    const method = t.paymentMethod ? `${t.paymentMethod} · ` : "";
    const typeLabel = t.type === "income" ? "Ingreso" : t.type === "expense" ? "Gasto" : "Retiro";
    const amountClass = t.type === "income" ? "amount-income" : t.type === "expense" ? "amount-expense" : "amount-withdrawal";
    const sign = t.type === "income" ? "+" : "−";

    return `
      <div class="transaction-row">
        <div>
          <strong>${escapeHtml(t.description)}</strong>
          <small>${typeLabel} · ${escapeHtml(t.category)} · ${method}${new Date(t.date).toLocaleDateString("es-MX")}</small>
        </div>
        <div class="${amountClass}">${sign}${money(t.amount)}</div>
      </div>
    `;
  }).join("");
}

function render() {
  setTheme();
  const totals = getTotals();

  if (exists("balanceAmount")) $("balanceAmount").textContent = money(totals.balance);
  if (exists("incomeAmount")) $("incomeAmount").textContent = money(totals.income);
  if (exists("expenseAmount")) $("expenseAmount").textContent = money(totals.expenses + totals.withdrawals);
  if (exists("freeAmount")) $("freeAmount").textContent = money(totals.balance);
  if (exists("todayLabel")) $("todayLabel").textContent = new Date().toLocaleDateString("es-MX", { weekday: "long", month: "short", day: "numeric" });

  const selectedType = document.querySelector('input[name="type"]:checked')?.value || "income";
  setActiveQuickAction(selectedType);
  togglePaymentMethod();
  renderTasks();
  renderTransactions();

  if (exists("githubToken") && getGithubToken() && !$("githubToken").value) {
    $("githubToken").placeholder = "Token guardado en este navegador";
    setSyncStatus("Sync activo");
  }
  if (exists("googleScriptUrl")) $("googleScriptUrl").value = getGoogleScriptUrl();
  if (exists("openAiProxyUrl")) $("openAiProxyUrl").value = getOpenAiProxyUrl();
}

function bindEvents() {
  $("transactionForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    addTransaction();
  });

  $("memoryForm")?.addEventListener("submit", addMemory);
  $("taskForm")?.addEventListener("submit", addTask);
  $("askAiBtn")?.addEventListener("click", askOpenAi);

  $("saveGithubConfig")?.addEventListener("click", () => {
    const token = $("githubToken")?.value.trim();
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

  $("pullGithubData")?.addEventListener("click", pullGithubData);

  $("saveGoogleConfig")?.addEventListener("click", () => {
    const url = $("googleScriptUrl")?.value.trim();
    if (!url) {
      alert("Pega primero tu Google Apps Script Web App URL.");
      return;
    }
    localStorage.setItem(GOOGLE_SCRIPT_URL_KEY, url);
    setSyncStatus("Google listo");
  });

  $("saveOpenAiConfig")?.addEventListener("click", () => {
    const url = $("openAiProxyUrl")?.value.trim();
    if (!url) {
      alert("Pega primero tu OpenAI proxy URL.");
      return;
    }
    localStorage.setItem(OPENAI_PROXY_URL_KEY, url);
    setSyncStatus("OpenAI listo");
  });

  $("themeToggle")?.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    save();
    render();
  });

  $("clearBtn")?.addEventListener("click", () => {
    if (confirm("¿Borrar todos los movimientos, pendientes y memorias locales?")) {
      state.transactions = [];
      state.tasks = [];
      state.memories = [];
      save();
      render();
    }
  });

  $("exportBtn")?.addEventListener("click", () => {
    const rows = [["date", "type", "description", "category", "paymentMethod", "amount"], ...state.transactions.map((t) => [t.date, t.type, t.description, t.category, t.paymentMethod || "", t.amount])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yair-os-finanzas.csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.querySelectorAll(".quick-actions [data-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      if (exists("typeIncome") && type === "income") $("typeIncome").checked = true;
      if (exists("typeExpense") && type === "expense") $("typeExpense").checked = true;
      if (exists("typeWithdrawal") && type === "withdrawal") $("typeWithdrawal").checked = true;
      setActiveQuickAction(type);
      togglePaymentMethod();
      $("movementPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => $("description")?.focus(), 250);
    });
  });

  document.querySelectorAll('input[name="type"]').forEach((input) => {
    input.addEventListener("change", () => {
      setActiveQuickAction(input.value);
      togglePaymentMethod();
    });
  });
}

bindEvents();
render();