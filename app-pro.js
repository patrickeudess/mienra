const DB_KEY = "mienra_web_app_v2";
const DB_BACKUP_KEY = `${DB_KEY}_last_good`;
const DEVICE_KEY = `${DB_KEY}_device_id`;

const $ = (id) => document.getElementById(id);
const LOGO_SRC = "assets/mienra-logo.jpeg";
const ASSET_VERSION = "20260707-backup-real-data";
const CLOUD_CONFIG = globalThis.MIENRA_CLOUD || {};
const SCHOOL_IDENTITY = {
  name: "EPP Mienrassou",
  code: "EPPM",
  subtitle: "École Maternelle et Primaire",
  legalName: "École primaire et privé",
  location: "Mienrassou - Daloa",
  phone: "07 07 70 44 54",
  email: "",
  director: "Direction de l’école"
};
const fmt = new Intl.NumberFormat("fr-FR");
const money = (value) => `${fmt.format(Number(value || 0))} FCFA`;
const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const clean = (value) => String(value ?? "").replace(/[&<>"']/g, (s) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
})[s]);
const logoUrl = () => `${LOGO_SRC}?v=${ASSET_VERSION}`;

let view = "dashboard";
let session = null;
let editing = null;
let editingEnrollment = null;
let activeReceipt = null;
let dashboardDetail = null;
let financeTab = "tracking";
let selectedPaymentStudent = null;
let cloudSyncing = false;
let cloudLastError = "";
let state = loadState();

const menu = [
  ["dashboard", "Tableau de bord", "◼"],
  ["students", "Élèves", "●"],
  ["classes", "Classes & frais", "▦"],
  ["finance", "Paiements & inscriptions", "+"],
  ["receipts", "Reçus", "#"],
  ["reports", "Rapports", "▤"],
  ["users", "Utilisateurs", "◎"],
  ["settings", "Paramètres", "⚙"],
  ["backup", "Sauvegardes", "⇩"]
];

const roleAccess = {
  Administrateur: {
    pages: ["dashboard", "students", "classes", "finance", "receipts", "reports", "users", "settings", "backup"],
    actions: ["students", "classes", "enrollments", "deleteEnrollments", "payments", "deletePayments", "dailyPoint", "users", "settings", "backup", "exports"]
  },
  Directeur: {
    pages: ["dashboard", "students", "classes", "finance", "receipts", "reports", "settings"],
    actions: ["students", "classes", "enrollments", "payments", "settings", "exports"]
  },
  Secrétaire: {
    pages: ["dashboard", "students", "finance", "receipts"],
    actions: ["students", "enrollments", "payments"]
  },
  Consultation: {
    pages: ["dashboard", "students", "finance", "receipts", "reports"],
    actions: []
  }
};

function seedState() {
  const classes = [
    ["CP1", "Primaire", 90000], ["CP2", "Primaire", 95000],
    ["CE1", "Primaire", 100000], ["CE2", "Primaire", 105000],
    ["CM1", "Primaire", 120000], ["CM2", "Primaire", 130000],
    ["6e", "Collège", 180000], ["5e", "Collège", 180000],
    ["4e", "Collège", 200000], ["3e", "Collège", 220000]
  ].map(([name, level, fee]) => ({ id: uid("CLS"), name, level, fee }));

  return {
    school: {
      name: SCHOOL_IDENTITY.name,
      code: SCHOOL_IDENTITY.code,
      year: "2026-2027",
      phone: SCHOOL_IDENTITY.phone,
      email: SCHOOL_IDENTITY.email,
      address: SCHOOL_IDENTITY.location,
      director: SCHOOL_IDENTITY.director,
      logo: "M",
      logoImage: LOGO_SRC,
      receiptPrefix: "REC",
      receiptFooter: "Merci pour votre paiement."
    },
    years: ["2025-2026", "2026-2027"],
    activeYear: "2026-2027",
    users: [
      { id: "USR-ADMIN", name: "Administrateur", login: "admin", password: "admin123", role: "Administrateur", active: true },
      { id: "USR-DIRECTEUR", name: "Directeur", login: "directeur", password: "directeur123", role: "Directeur", active: true },
      { id: "USR-SECRETAIRE", name: "Secrétaire", login: "secretaire", password: "secretaire123", role: "Secrétaire", active: true },
      { id: "USR-CONSULTATION", name: "Consultation", login: "consultation", password: "consultation123", role: "Consultation", active: true }
    ],
    classes,
    students: [],
    enrollments: [],
    payments: [],
    logs: [],
    backups: []
  };
}

function blankState() {
  const base = seedState();
  return {
    ...base,
    classes: [],
    students: [],
    enrollments: [],
    payments: [],
    logs: []
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY));
    return saved ? normalizeState(saved) : (cloudEnabled() ? blankState() : seedState());
  } catch {
    return cloudEnabled() ? blankState() : seedState();
  }
}

function normalizeState(data) {
  const base = blankState();
  const normalized = {
    ...base,
    ...data,
    school: { ...base.school, ...(data.school || {}) },
    years: data.years?.length ? data.years : base.years,
    classes: Array.isArray(data.classes) ? data.classes : base.classes,
    students: (Array.isArray(data.students) ? data.students : base.students).map((row) => ({ ...row, addedDate: row.addedDate || row.createdAt || today() })),
    enrollments: (Array.isArray(data.enrollments) ? data.enrollments : base.enrollments).map((row) => ({ ...row, year: row.year || data.activeYear || data.school?.year || base.school.year })),
    payments: (Array.isArray(data.payments) ? data.payments : base.payments).map((row) => ({ ...row, year: row.year || data.activeYear || data.school?.year || base.school.year })),
    users: data.users?.length ? data.users : base.users,
    logs: normalizeLogs(data.logs || []),
    activeYear: data.activeYear || data.school?.year || base.activeYear,
    updatedAt: data.updatedAt || new Date().toISOString()
  };
  if (!normalized.years.includes(normalized.activeYear)) normalized.years.push(normalized.activeYear);
  normalized.school = migrateSchoolIdentity(normalized.school);
  return normalized;
}

function normalizeLogs(rows = []) {
  return rows.map((row) => ({
    id: row.id || uid("LOG"),
    iso: row.iso || row.date || new Date().toISOString(),
    date: row.date || new Date(row.iso || Date.now()).toLocaleString("fr-FR"),
    user: row.user || "Système",
    role: row.role || "",
    type: row.type || "Action",
    action: row.action || "",
    device: row.device || "",
    detail: row.detail || ""
  })).slice(0, 500);
}

function mergeById(remoteRows = [], localRows = []) {
  const rows = new Map();
  remoteRows.forEach((row) => row?.id && rows.set(row.id, row));
  localRows.forEach((row) => row?.id && rows.set(row.id, { ...(rows.get(row.id) || {}), ...row }));
  return [...rows.values()];
}

function mergeLogs(remoteRows = [], localRows = []) {
  const rows = new Map();
  [...remoteRows, ...localRows].forEach((row) => {
    const normalized = normalizeLogs([row])[0];
    const key = normalized.id || [normalized.iso, normalized.user, normalized.action, normalized.device].join("|");
    if (key.trim()) rows.set(key, row);
  });
  return normalizeLogs([...rows.values()]).sort((a, b) => new Date(b.iso) - new Date(a.iso)).slice(0, 500);
}

function mergeStates(localData, remoteData) {
  const local = normalizeState(localData || {});
  const remote = normalizeState(remoteData || {});
  const localTime = new Date(local.updatedAt || 0).getTime();
  const remoteTime = new Date(remote.updatedAt || 0).getTime();
  const newestBase = localTime >= remoteTime ? local : remote;
  return normalizeState({
    ...newestBase,
    school: { ...remote.school, ...local.school },
    years: [...new Set([...(remote.years || []), ...(local.years || [])])],
    classes: mergeById(remote.classes, local.classes),
    students: mergeById(remote.students, local.students),
    enrollments: mergeById(remote.enrollments, local.enrollments),
    payments: mergeById(remote.payments, local.payments),
    users: mergeById(remote.users, local.users),
    logs: mergeLogs(remote.logs, local.logs),
    updatedAt: new Date(Math.max(localTime || 0, remoteTime || 0, Date.now())).toISOString()
  });
}

function migrateSchoolIdentity(school) {
  const legacyNames = ["Groupe Scolaire MIENRA", "MIENRA Web", "MIENRA"];
  const shouldUpdate = !school.name || legacyNames.includes(school.name);
  return {
    ...school,
    name: shouldUpdate ? SCHOOL_IDENTITY.name : school.name,
    code: !school.code || school.code === "GSM" ? SCHOOL_IDENTITY.code : school.code,
    phone: !school.phone || school.phone === "+225 07 00 00 00 00" ? SCHOOL_IDENTITY.phone : school.phone,
    email: school.email === "contact@mienra.ci" ? SCHOOL_IDENTITY.email : school.email,
    address: !school.address || school.address === "Abidjan, Côte d’Ivoire" ? SCHOOL_IDENTITY.location : school.address,
    director: !school.director || school.director === "Directeur de l’école" ? SCHOOL_IDENTITY.director : school.director,
    logoImage: LOGO_SRC
  };
}

function saveRecoverySnapshot() {
  try {
    const current = localStorage.getItem(DB_KEY);
    if (current) localStorage.setItem(DB_BACKUP_KEY, current);
  } catch {}
}

function saveLocalState() {
  saveRecoverySnapshot();
  localStorage.setItem(DB_KEY, JSON.stringify(state));
}
function saveState() {
  state.updatedAt = new Date().toISOString();
  saveLocalState();
  pushSharedState();
}
function cloudEnabled() {
  return Boolean(CLOUD_CONFIG.enabled && CLOUD_CONFIG.provider === "supabase" && CLOUD_CONFIG.supabaseUrl && CLOUD_CONFIG.supabaseAnonKey);
}
function cloudStateId() {
  return encodeURIComponent(CLOUD_CONFIG.stateId || "epp-mienrassou");
}
function syncLabel() {
  if (!cloudEnabled()) return "Données locales";
  if (cloudLastError) return "Sync à vérifier";
  return "Données partagées";
}
function supabaseHeaders(extra = {}) {
  return {
    apikey: CLOUD_CONFIG.supabaseAnonKey,
    Authorization: `Bearer ${CLOUD_CONFIG.supabaseAnonKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}
async function pullSharedState() {
  if (!cloudEnabled()) return false;
  try {
    const url = `${CLOUD_CONFIG.supabaseUrl.replace(/\/$/, "")}/rest/v1/mienra_app_state?id=eq.${cloudStateId()}&select=data,updated_at&limit=1`;
    const response = await fetch(url, { headers: supabaseHeaders() });
    if (!response.ok) throw new Error(`Lecture Supabase impossible (${response.status})`);
    const rows = await response.json();
    if (rows[0]?.data) {
      state = mergeStates(state, { ...rows[0].data, updatedAt: rows[0].data.updatedAt || rows[0].updated_at });
      saveLocalState();
      await pushSharedState();
    } else {
      await pushSharedState();
    }
    cloudLastError = "";
    return true;
  } catch (error) {
    cloudLastError = error.message || "Synchronisation impossible";
    console.warn(cloudLastError);
    return false;
  }
}
async function pushSharedState() {
  if (!cloudEnabled() || cloudSyncing) return false;
  cloudSyncing = true;
  try {
    const url = `${CLOUD_CONFIG.supabaseUrl.replace(/\/$/, "")}/rest/v1/mienra_app_state?on_conflict=id`;
    const response = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ id: CLOUD_CONFIG.stateId || "epp-mienrassou", data: state, updated_at: new Date().toISOString() })
    });
    if (!response.ok) throw new Error(`Écriture Supabase impossible (${response.status})`);
    cloudLastError = "";
    return true;
  } catch (error) {
    cloudLastError = error.message || "Synchronisation impossible";
    console.warn(cloudLastError);
    return false;
  } finally {
    cloudSyncing = false;
  }
}
function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `APP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
function log(action, type = "Action", detail = "") {
  const now = new Date();
  state.logs.unshift({
    id: uid("LOG"),
    iso: now.toISOString(),
    date: now.toLocaleString("fr-FR"),
    user: session?.name || "Système",
    role: session?.role || "",
    type,
    action,
    device: deviceId(),
    detail
  });
  state.logs = normalizeLogs(state.logs).slice(0, 500);
  saveState();
}

function classFee(classes, name) { return Number(classes.find((item) => item.name === name)?.fee || 0); }
function student(id) { return state.students.find((item) => item.id === id) || {}; }
function enrollmentDue(item) {
  const fee = classFee(state.classes, item.className);
  const amount = Number(item.amount || 0);
  if (!fee) return amount;
  return amount > 0 ? Math.min(amount, fee) : fee;
}
function enrollmentNet(item) { return Math.max(0, enrollmentDue(item) - Number(item.discount || 0)); }
function currentYear() { return state.activeYear || state.school.year; }
function due(id, year = currentYear()) {
  const studentEnrollments = state.enrollments.filter((item) => item.studentId === id);
  const rows = studentEnrollments.filter((item) => item.year === year);
  if (!rows.length && studentEnrollments.length) return 0;
  if (!rows.length) return classFee(state.classes, student(id).className);
  return rows.reduce((sum, item) => sum + enrollmentNet(item), 0);
}
function paid(id, year = currentYear()) { return state.payments.filter((item) => item.studentId === id && item.year === year).reduce((sum, item) => sum + Number(item.amount || 0), 0); }
function balance(id, year = currentYear()) { return due(id, year) - paid(id, year); }
function percent(id, year = currentYear()) { const total = due(id, year); return total ? Math.min(100, Math.round((paid(id, year) / total) * 100)) : 0; }
function paymentPaidBefore(payment) {
  if (Number.isFinite(payment.paidBefore)) return Number(payment.paidBefore);
  const index = state.payments.findIndex((row) => row.id === payment.id);
  const olderRows = index >= 0 ? state.payments.slice(index + 1) : [];
  return olderRows.filter((row) => row.studentId === payment.studentId && row.year === payment.year).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}
function receiptAmounts(payment) {
  const expected = Number.isFinite(payment.expectedAtPayment) ? Number(payment.expectedAtPayment) : due(payment.studentId, payment.year || currentYear());
  const paidBefore = paymentPaidBefore(payment);
  const currentPaid = Number(payment.amount || 0);
  const totalPaid = Number.isFinite(payment.totalPaidAfter) ? Number(payment.totalPaidAfter) : paidBefore + currentPaid;
  const remaining = Number.isFinite(payment.balanceAfter) ? Number(payment.balanceAfter) : expected - totalPaid;
  return { expected, paidBefore, currentPaid, totalPaid, remaining };
}
function paymentPayer(payment) {
  return payment.paidBy || student(payment.studentId).parent || "-";
}
function lastPaymentForStudent(studentId) {
  return state.payments.find((row) => row.studentId === studentId && row.year === currentYear());
}
function totals() {
  const expected = state.students.reduce((sum, item) => sum + due(item.id), 0);
  const collected = state.students.reduce((sum, item) => sum + paid(item.id), 0);
  return { expected, collected, remaining: expected - collected, rate: expected ? Math.round((collected / expected) * 100) : 0 };
}

function genderTotals() {
  return ["F", "M"].map((gender) => {
    const rows = state.students.filter((row) => row.gender === gender);
    const expected = rows.reduce((sum, row) => sum + due(row.id), 0);
    const collected = rows.reduce((sum, row) => sum + paid(row.id), 0);
    return { gender, label: gender === "F" ? "Filles" : "Garçons", count: rows.length, expected, collected, remaining: expected - collected };
  });
}

function accessProfile() {
  return roleAccess[session?.role] || roleAccess.Consultation;
}

function availableMenu() {
  const pages = accessProfile().pages;
  return menu.filter(([key]) => pages.includes(key));
}

function canPage(key) {
  return accessProfile().pages.includes(key);
}

function canAction(action) {
  return accessProfile().actions.includes(action);
}

function requireAction(action) {
  if (canAction(action)) return true;
  log(`Accès refusé : ${action}`, "Sécurité", `Rôle : ${session?.role || "-"}`);
  alert("Accès refusé pour ce rôle.");
  return false;
}

function ensureAllowedView() {
  if (canPage(view)) return;
  view = availableMenu()[0]?.[0] || "dashboard";
}

function init() { renderLogin(); }

function renderLogin() {
  $("root").innerHTML = `
    <section class="login">
      <div class="login-panel">
        <div class="login-brand"><img class="brand-logo" src="${logoUrl()}" alt="Logo EPP Mienrassou"><div><h1>EPP Mienrassou</h1><p>Gestion scolaire : élèves, inscriptions, paiements, reçus et rapports.</p></div></div>
        <label>Identifiant</label><input id="login" value="admin" autocomplete="username">
        <label>Mot de passe</label><input id="password" type="password" value="admin123" autocomplete="current-password">
        <div class="actions"><button class="btn primary" onclick="login()">Se connecter</button><button class="btn quiet" onclick="quickLogin()">Accès rapide admin</button></div>
        <div class="hint">Comptes test : admin/admin123, directeur/directeur123, secretaire/secretaire123, consultation/consultation123<br>Mode données : ${syncLabel()}</div>
      </div>
    </section>`;
}

async function login() {
  await pullSharedState();
  const username = $("login").value.trim();
  const password = $("password").value.trim();
  const user = state.users.find((item) => item.login === username && item.password === password && item.active);
  if (!user) {
    log(`Tentative de connexion échouée : ${username || "identifiant vide"}`, "Connexion", "Identifiant incorrect ou compte inactif");
    return alert("Identifiants incorrects ou compte inactif.");
  }
  session = user;
  log("Connexion réussie", "Connexion");
  renderShell();
}

async function quickLogin() {
  await pullSharedState();
  session = state.users.find((item) => item.login === "admin") || state.users[0];
  log("Connexion accès rapide", "Connexion");
  renderShell();
}

function logout() {
  log("Déconnexion", "Connexion");
  session = null;
  renderLogin();
}

async function syncNow() {
  const ok = await pullSharedState();
  if (ok) {
    log("Synchronisation manuelle", "Synchronisation");
    renderShell();
    alert("Données synchronisées.");
  } else {
    log("Échec synchronisation manuelle", "Synchronisation", cloudLastError);
    alert(cloudEnabled() ? `Synchronisation impossible : ${cloudLastError}` : "La synchronisation partagée n'est pas encore configurée.");
  }
}

function yearSelector() {
  return `<label class="year-select">Année scolaire<select id="activeYear" onchange="setActiveYear(this.value)">${state.years.map((year) => `<option value="${clean(year)}" ${year === currentYear() ? "selected" : ""}>${clean(year)}</option>`).join("")}</select></label>`;
}

function setActiveYear(year) {
  state.activeYear = year || state.school.year;
  if (!state.years.includes(state.activeYear)) state.years.push(state.activeYear);
  log(`Année scolaire sélectionnée : ${state.activeYear}`, "Année scolaire");
  saveState();
  renderShell();
}

function renderShell() {
  ensureAllowedView();
  $("root").innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand-row"><img class="brand-logo small-logo" src="${logoUrl()}" alt="Logo EPP Mienrassou"><div><strong>EPP Mienrassou</strong><span>${clean(currentYear())}</span></div></div>
        <div class="account"><b>${clean(session.name)}</b><span>${clean(session.role)} · ${syncLabel()}</span><button class="btn small quiet" onclick="logout()">Déconnexion</button></div>
        <nav id="nav"></nav>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div><p>${clean(state.school.name)}</p><h1 id="pageTitle"></h1></div>
          <div class="top-actions">${yearSelector()}${cloudEnabled() ? `<button class="btn quiet" onclick="syncNow()">Synchroniser</button>` : ""}${canPage("backup") ? `<button class="btn quiet" onclick="go('backup')">Sauvegardes</button>` : ""}${canAction("payments") ? `<button class="btn secondary" onclick="showFinanceTab('payments')">Nouveau paiement</button>` : ""}</div>
        </header>
        <section id="content"></section>
      </main>
    </div>`;
  renderNav();
  renderView();
}

function renderNav() {
  $("nav").innerHTML = availableMenu().map(([key, label, icon]) => `<button class="${view === key ? "active" : ""}" onclick="go('${key}')"><span>${icon}</span>${label}</button>`).join("");
}

function go(key) {
  const financeAliases = { enrollments: "payments", payments: "payments", unpaid: "tracking" };
  if (financeAliases[key]) {
    financeTab = financeAliases[key];
    key = "finance";
  }
  if (!canPage(key)) return alert("Accès refusé pour ce rôle.");
  view = key;
  editing = null;
  if (key !== "finance") editingEnrollment = null;
  if (key !== "dashboard") dashboardDetail = null;
  renderNav();
  renderView();
}

function showFinanceTab(tab) {
  if (!canPage("finance")) return alert("Accès refusé pour ce rôle.");
  financeTab = tab || "tracking";
  view = "finance";
  editing = null;
  editingEnrollment = null;
  renderNav();
  renderView();
}

function renderView() {
  ensureAllowedView();
  $("pageTitle").textContent = menu.find(([key]) => key === view)?.[1] || "MIENRA";
  pages[view]();
}

const pages = {
  dashboard() {
    const t = totals();
    $("content").innerHTML = `
      ${dashboardDetail ? dashboardDetailPanel(dashboardDetail) : ""}
      <div class="stats">${stat("Élèves", state.students.length)}${stat("Montant attendu", money(t.expected))}${stat("Montant encaissé", money(t.collected))}${stat("Reste à payer", money(t.remaining), t.remaining > 0 ? "danger" : "ok")}</div>
      <div class="layout-two">
        <article class="panel"><div class="panel-head"><h2>Recouvrement par classe</h2><span>${t.rate}% encaissé</span></div>${classSummary()}</article>
        <article class="panel"><div class="panel-head"><h2>Désagrégation par sexe</h2><span>Effectif et paiements</span></div>${genderSummary()}</article>
        <article class="panel"><div class="panel-head"><h2>Activité récente</h2><span>${state.logs.length} opérations</span></div>${logsTable(9)}</article>
      </div>`;
    attachDashboardStatActions();
    if (dashboardDetail) drawDashboardDetail();
  },
  finance() {
    const allowedTabs = [
      canAction("payments") ? "payments" : null,
      "tracking"
    ].filter(Boolean);
    if (!allowedTabs.includes(financeTab)) financeTab = allowedTabs[0] || "tracking";
    const t = totals();
    const paymentPanel = `${canAction("payments") ? `<article class="panel"><div class="panel-head"><h2>Nouveau paiement</h2><span>Encaissement et reçu - ${clean(currentYear())}</span></div><div class="form-grid"><div class="student-picker"><label>Rechercher l’élève</label><input id="paySearch" placeholder="Nom, matricule, parent, contact..." oninput="drawPaymentStudentResults()"><select id="payStudent" onchange="paymentInfo()">${state.students.map((row) => `<option value="${row.id}">${clean(row.name)} - ${clean(row.matricule)} - reste ${money(balance(row.id))}</option>`).join("")}</select><div id="payStudentResults" class="picker-results"></div></div>${field("Montant payé", "payAmount", 50000, "number")}${field("Payé par", "paidBy", "")}<div><label>Mode</label><select id="payMode"><option>Espèces</option><option>Orange Money</option><option>Moov Money</option><option>MTN Money</option><option>Wave</option></select></div>${field("Date", "payDate", today(), "date")}${field("Caissier", "cashier", session.name)}${field("Note", "payNote", "Versement frais scolaires")}</div><div class="notice" id="payInfo"></div><div class="actions"><button class="btn primary" onclick="savePayment()">Enregistrer et générer le reçu</button></div></article>` : readOnlyNotice("Paiements")}`;
    const trackingPanel = `${canAction("dailyPoint") ? dailyPointPanel() : ""}<article class="panel"><div class="panel-head"><h2>Situation par élève</h2><span>${money(t.remaining)} à recouvrer</span></div>${financialFilters("unpaid")}<div id="unpaidTable"></div></article><article class="panel"><div class="panel-head"><h2>Reçus enregistrés</h2><span>${state.payments.filter((row) => row.year === currentYear()).length} paiements - ${clean(currentYear())}</span></div>${paymentsTable()}</article>`;
    $("content").innerHTML = `<div class="subtabs">${allowedTabs.map((tab) => `<button class="${financeTab === tab ? "active" : ""}" onclick="showFinanceTab('${tab}')">${tab === "payments" ? "Encaisser" : "Suivi & reçus"}</button>`).join("")}</div>${financeTab === "payments" ? paymentPanel : trackingPanel}`;
    if (financeTab === "payments") { drawPaymentStudentResults(); paymentInfo(); }
    if (financeTab === "tracking") { if (canAction("dailyPoint")) drawDailyPoint(); drawUnpaid(); }
  },
  students() {
    const item = editing ? state.students.find((row) => row.id === editing) : {};
    $("content").innerHTML = `
      ${canAction("students") ? `<article class="panel"><div class="panel-head"><h2>${editing ? "Modifier un élève" : "Ajouter un élève"}</h2><span>Identité, classe et parent</span></div>${studentForm(item)}<div class="actions"><button class="btn primary" onclick="saveStudent()">Enregistrer</button>${editing ? `<button class="btn quiet" onclick="editing=null;pages.students()">Annuler</button>` : ""}</div></article>` : readOnlyNotice("Élèves")}
      <article class="panel"><div class="panel-head"><h2>Liste des élèves</h2><span>${state.students.length} dossiers</span></div><div class="filters"><input id="studentSearch" placeholder="Rechercher nom, matricule, parent, contact..." oninput="drawStudents()"><select id="studentClass" onchange="drawStudents()"><option value="">Toutes les classes</option>${state.classes.map((row) => `<option>${clean(row.name)}</option>`).join("")}</select><select id="studentPayment" onchange="drawStudents()"><option value="">Tous statuts</option><option value="paid">Soldés</option><option value="partial">Partiels</option><option value="unpaid">Impayés</option></select></div><div id="studentsTable"></div></article>`;
    drawStudents();
  },
  classes() {
    const item = editing ? state.classes.find((row) => row.id === editing) : {};
    $("content").innerHTML = `
      ${canAction("classes") ? `<article class="panel"><div class="panel-head"><h2>${editing ? "Modifier une classe" : "Ajouter une classe"}</h2><span>Frais scolaires annuels</span></div><div class="form-grid">${field("Classe", "className", item?.name || "")}<div><label>Niveau</label><select id="level">${["Maternelle", "Primaire", "Collège", "Lycée", "Supérieur"].map((level) => `<option ${item?.level === level ? "selected" : ""}>${level}</option>`).join("")}</select></div>${field("Frais annuels", "fee", item?.fee || 100000, "number")}</div><div class="actions"><button class="btn primary" onclick="saveClass()">Enregistrer</button></div></article>` : readOnlyNotice("Classes")}
      <article class="panel"><div class="panel-head"><h2>Classes & frais</h2><span>${state.classes.length} classes</span></div><table><thead><tr><th>Classe</th><th>Niveau</th><th>Frais</th><th>Élèves</th><th>Actions</th></tr></thead><tbody>${state.classes.map((row) => `<tr><td>${clean(row.name)}</td><td>${clean(row.level)}</td><td>${money(row.fee)}</td><td>${state.students.filter((s) => s.className === row.name).length}</td><td>${rowActions("Class", row.id)}</td></tr>`).join("")}</tbody></table></article>`;
  },
  receipts() { receiptView(); },
  reports() {
    const t = totals();
    $("content").innerHTML = `<article class="panel printable-document">${documentHeader(`Rapport financier - ${currentYear()}`)}<div class="stats">${stat("Attendu", money(t.expected))}${stat("Encaissé", money(t.collected))}${stat("Impayés", money(t.remaining), "danger")}${stat("Taux", `${t.rate}%`)}</div></article><article class="panel"><div class="panel-head"><h2>Exports et impression</h2><span>Données du navigateur</span></div><div class="actions">${canAction("exports") ? `<button class="btn secondary" onclick="exportCSV('students')">Exporter élèves CSV</button><button class="btn secondary" onclick="exportCSV('payments')">Exporter paiements CSV</button><button class="btn secondary" onclick="exportCSV('paidStudents')">Élèves qui ont payé CSV</button><button class="btn secondary" onclick="exportCSV('noPaymentStudents')">Élèves sans paiement CSV</button><button class="btn secondary" onclick="exportCSV('unpaid')">Exporter impayés CSV</button><button class="btn secondary" onclick="exportCSV('logs')">Exporter journal CSV</button>` : ""}<button class="btn quiet" onclick="window.print()">Imprimer le rapport</button></div></article><article class="panel printable-document"><div class="panel-head"><h2>Rapport par classe</h2><span>Synthèse financière - ${clean(currentYear())}</span></div>${classSummary()}</article>`;
  },
  users() {
    const item = editing ? state.users.find((row) => row.id === editing) : {};
    $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>${editing ? "Modifier un utilisateur" : "Ajouter un utilisateur"}</h2><span>Comptes locaux de test</span></div><div class="form-grid">${field("Nom", "userName", item?.name || "")}${field("Identifiant", "userLogin", item?.login || "")}${field("Mot de passe", "userPass", item?.password || "123456")}<div><label>Rôle</label><select id="userRole">${["Administrateur", "Directeur", "Secrétaire", "Consultation"].map((role) => `<option ${item?.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></div><div><label>Statut</label><select id="userActive"><option value="true" ${item?.active !== false ? "selected" : ""}>Actif</option><option value="false" ${item?.active === false ? "selected" : ""}>Verrouillé</option></select></div></div><div class="actions"><button class="btn primary" onclick="saveUser()">Enregistrer</button></div></article><article class="panel"><div class="panel-head"><h2>Utilisateurs</h2><span>${state.users.length} comptes</span></div><table><thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${state.users.map((row) => `<tr><td>${clean(row.name)}</td><td>${clean(row.login)}</td><td>${clean(row.role)}</td><td>${row.active ? "Actif" : "Verrouillé"}</td><td>${userActions(row)}</td></tr>`).join("")}</tbody></table></article>`;
  },
  settings() {
    const item = state.school;
    $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>Paramètres de l’établissement</h2><span>Identité sur reçus et exports</span></div><div class="settings-logo"><img src="${logoUrl()}" alt="Logo EPP Mienrassou"><span>Logo officiel et informations de EPP Mienrassou utilisés sur les reçus et documents imprimables.</span></div><div class="form-grid">${field("Nom école", "schoolName", item.name)}${field("Code", "schoolCode", item.code)}${field("Année active", "schoolYear", item.year)}${field("Téléphone", "schoolPhone", item.phone)}${field("Email", "schoolEmail", item.email)}${field("Adresse", "schoolAddress", item.address)}${field("Directeur", "director", item.director)}${field("Préfixe reçu", "receiptPrefix", item.receiptPrefix)}${field("Logo texte secours", "logo", item.logo)}</div><div><label>Message reçu</label><textarea id="receiptFooter">${clean(item.receiptFooter)}</textarea></div><div class="actions"><button class="btn primary" onclick="saveSettings()">Enregistrer les paramètres</button></div></article>`;
  },
  backup() {
    $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>Sauvegardes</h2><span>Export/import JSON</span></div><p class="muted">Mode actuel : ${syncLabel()}. Exportez un fichier JSON pour archiver la base et utilisez la restauration locale si une actualisation a masqué des données récentes.</p><div class="actions"><button class="btn secondary" onclick="downloadBackup()">Exporter JSON</button><button class="btn quiet" onclick="restoreLocalBackup()">Restaurer copie locale</button><button class="btn danger" onclick="resetApp()">Réinitialiser</button></div><label>Importer une sauvegarde JSON</label><input type="file" accept=".json" onchange="importBackup(this)"></article><article class="panel"><div class="panel-head"><h2>Journal</h2><span>${state.logs.length} opérations</span></div>${logsTable(80)}</article>`;
  }
};

pages.backup = function() {
  $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>Sauvegardes</h2><span>Base complÃ¨te</span></div><p class="muted">Mode actuel : ${syncLabel()}. La sauvegarde JSON contient toutes les informations enregistrÃ©es dans l'application : Ã©cole, annÃ©es scolaires, utilisateurs, classes, Ã©lÃ¨ves, inscriptions, paiements, reÃ§us et journal.</p><div class="actions"><button class="btn secondary" onclick="downloadBackup()">Exporter toute la base JSON</button><button class="btn quiet" onclick="restoreLocalBackup()">Restaurer copie locale</button><button class="btn danger" onclick="removeDemoData()">Supprimer donnÃ©es dÃ©mo</button><button class="btn danger" onclick="resetApp()">RÃ©initialiser</button></div><label>Importer une sauvegarde JSON</label><input type="file" accept=".json" onchange="importBackup(this)"></article><article class="panel"><div class="panel-head"><h2>DonnÃ©es enregistrÃ©es</h2><span>Vue complÃ¨te</span></div>${databaseOverview()}</article><article class="panel"><div class="panel-head"><h2>Journal</h2><span>${state.logs.length} opÃ©rations</span></div>${logsTable(80)}</article>`;
};

function stat(label, value, tone = "") { return `<div class="stat ${tone}"><span>${label}</span><strong>${value}</strong></div>`; }
function field(label, id, value = "", type = "text") { return `<div><label>${label}</label><input id="${id}" type="${type}" value="${clean(value)}"></div>`; }
function attachDashboardStatActions() {
  const cards = [...document.querySelectorAll(".stats .stat")];
  [
    [2, "collected"],
    [3, "remaining"]
  ].forEach(([index, type]) => {
    const card = cards[index];
    if (!card) return;
    card.classList.add("clickable");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.onclick = () => showDashboardDetail(type);
    card.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") showDashboardDetail(type);
    };
  });
}
function documentHeader(title = state.school.name) {
  const contact = [state.school.address, state.school.phone, state.school.email].filter(Boolean).map(clean).join(" · ");
  return `<div class="document-header"><img class="document-logo" src="${logoUrl()}" alt="Logo EPP Mienrassou" onerror="this.classList.add('logo-failed')"><div><div class="logo-text"><b>${clean(SCHOOL_IDENTITY.subtitle)}</b><span>${clean(SCHOOL_IDENTITY.legalName)}</span><strong>MIENRASSOU - DALOA</strong><em>Tél : ${clean(SCHOOL_IDENTITY.phone)}</em></div><h2>${clean(title)}</h2><p>${clean(state.school.name)}${contact ? ` · ${contact}` : ""}</p></div></div>`;
}
function readOnlyNotice(label) { return `<article class="panel notice">${label} : affichage en lecture seule pour le rôle ${clean(session?.role || "")}.</article>`; }
function actionForScope(scope) { return ({ Class: "classes", User: "users" })[scope]; }
function rowActions(scope, id) {
  if (!canAction(actionForScope(scope))) return `<span class="muted">Lecture seule</span>`;
  return `<button class="btn quiet small" onclick="edit${scope}('${id}')">Modifier</button> <button class="btn danger small" onclick="delete${scope}('${id}')">Supprimer</button>`;
}

function userActions(row) {
  if (!canAction("users")) return `<span class="muted">Lecture seule</span>`;
  const lockLabel = row.active ? "Verrouiller" : "Déverrouiller";
  const lockClass = row.active ? "danger" : "secondary";
  return `<button class="btn quiet small" onclick="editUser('${row.id}')">Modifier</button> <button class="btn ${lockClass} small" onclick="toggleUserLock('${row.id}')">${lockLabel}</button> <button class="btn danger small" onclick="deleteUser('${row.id}')">Supprimer</button>`;
}

function studentForm(item) {
  return `<div class="form-grid">${field("Nom complet", "stName", item?.name || "")}<div><label>Genre</label><select id="stGender"><option ${item?.gender === "M" ? "selected" : ""}>M</option><option ${item?.gender === "F" ? "selected" : ""}>F</option></select></div>${field("Date naissance", "stBirth", item?.birth || "", "date")}${field("Date d'ajout", "stAddedDate", item?.addedDate || today(), "date")}<div><label>Classe</label><select id="stClass">${state.classes.map((row) => `<option ${item?.className === row.name ? "selected" : ""}>${clean(row.name)}</option>`).join("")}</select></div>${field("Parent/Tuteur", "stParent", item?.parent || "")}${field("Contact", "stPhone", item?.phone || "")}${field("Adresse", "stAddress", item?.address || "")}<div><label>Statut</label><select id="stStatus">${["Actif", "Inactif", "Transféré"].map((status) => `<option ${item?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div></div>`;
}

function drawStudents() {
  const q = ($("studentSearch")?.value || "").toLowerCase();
  const className = $("studentClass")?.value || "";
  const payStatus = $("studentPayment")?.value || "";
  let rows = state.students.filter((row) => [row.name, row.matricule, row.parent, row.phone, row.className].join(" ").toLowerCase().includes(q));
  if (className) rows = rows.filter((row) => row.className === className);
  if (payStatus === "paid") rows = rows.filter((row) => balance(row.id) <= 0 && due(row.id) > 0);
  if (payStatus === "partial") rows = rows.filter((row) => balance(row.id) > 0 && paid(row.id) > 0);
  if (payStatus === "unpaid") rows = rows.filter((row) => balance(row.id) > 0 && paid(row.id) === 0);
  $("studentsTable").innerHTML = `<table><thead><tr><th>Matricule</th><th>Élève</th><th>Date d'ajout</th><th>Classe</th><th>Parent</th><th>Paiement</th><th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${clean(row.matricule)}</td><td>${clean(row.name)}<br><small>${clean(row.gender)} · ${clean(row.status)}</small></td><td>${clean(row.addedDate || "-")}</td><td>${clean(row.className)}</td><td>${clean(row.parent)}<br><small>${clean(row.phone)}</small></td><td>${paymentStatus(row)}</td><td>${studentActions(row.id)}</td></tr>`).join("") || `<tr><td colspan="7">Aucun élève trouvé.</td></tr>`}</tbody></table>`;
}

function studentActions(id) {
  const actions = [];
  if (canAction("students")) actions.push(`<button class="btn quiet small" onclick="editStudent('${id}')">Modifier</button>`, `<button class="btn danger small" onclick="deleteStudent('${id}')">Supprimer</button>`);
  return actions.length ? actions.join(" ") : `<span class="muted">Lecture seule</span>`;
}

function paymentStatus(row) {
  const left = balance(row.id);
  const collected = paid(row.id);
  const label = left <= 0 ? "Soldé" : collected > 0 ? "Partiel" : "Impayé";
  const tone = left <= 0 ? "amount-ok" : collected > 0 ? "amount-warn" : "amount-danger";
  return `<b class="${tone}">${label}</b><div class="progress"><span style="width:${percent(row.id)}%"></span></div><small>${percent(row.id)}% · reste ${money(left)}</small>`;
}

function financeStatus(row) {
  const left = balance(row.id);
  const collected = paid(row.id);
  if (due(row.id) <= 0) return "Sans frais";
  if (left <= 0) return "Soldé";
  return collected > 0 ? "Partiel" : "Impayé";
}

function financialFilters(prefix, includeDate = false) {
  const handler = prefix === "dash" ? "drawDashboardDetail()" : "drawUnpaid()";
  return `<div class="filters financial-filters">
    <input id="${prefix}Search" placeholder="Rechercher nom, matricule, parent, contact..." oninput="${handler}">
    <select id="${prefix}Class" onchange="${handler}"><option value="">Toutes les classes</option>${state.classes.map((row) => `<option>${clean(row.name)}</option>`).join("")}</select>
    <select id="${prefix}Status" onchange="${handler}"><option value="">Tous statuts</option><option value="paid">Soldés</option><option value="partial">Partiels</option><option value="unpaid">Impayés</option></select>
    ${includeDate ? `<input id="${prefix}Date" type="date" onchange="drawDashboardDetail()">` : ""}
  </div>`;
}

function filterFinancialStudents(prefix, rows = state.students) {
  const q = ($(prefix + "Search")?.value || "").toLowerCase();
  const className = $(prefix + "Class")?.value || "";
  const status = $(prefix + "Status")?.value || "";
  let filtered = rows.filter((row) => [row.name, row.matricule, row.parent, row.phone, row.className].join(" ").toLowerCase().includes(q));
  if (className) filtered = filtered.filter((row) => row.className === className);
  if (status === "paid") filtered = filtered.filter((row) => balance(row.id) <= 0 && due(row.id) > 0);
  if (status === "partial") filtered = filtered.filter((row) => balance(row.id) > 0 && paid(row.id) > 0);
  if (status === "unpaid") filtered = filtered.filter((row) => balance(row.id) > 0 && paid(row.id) === 0);
  return filtered;
}

function financialRows(rows, emptyMessage = "Aucun élève trouvé.") {
  return `<table><thead><tr><th>Élève</th><th>Classe</th><th>Frais classe</th><th>Déjà payé</th><th>Reste à payer</th><th>Statut</th><th>Payé par</th><th>Parent</th><th>Action</th></tr></thead><tbody>${rows.map((row) => {
    const left = balance(row.id);
    const lastPayment = lastPaymentForStudent(row.id);
    return `<tr><td>${clean(row.name)}<br><small>${clean(row.matricule)}</small></td><td>${clean(row.className)}</td><td>${money(due(row.id))}</td><td class="amount-ok">${money(paid(row.id))}</td><td class="${left > 0 ? "amount-danger" : "amount-ok"}">${money(left)}</td><td>${financeStatus(row)}</td><td>${lastPayment ? clean(paymentPayer(lastPayment)) : "-"}</td><td>${clean(row.parent)}<br><small>${clean(row.phone)}</small></td><td><button class="btn quiet small" onclick="showStudentPayments('${row.id}')">Versements</button>${canAction("payments") ? ` <button class="btn secondary small" onclick="goPay('${row.id}')">Payer</button>` : ""}</td></tr>`;
  }).join("") || `<tr><td colspan="9">${emptyMessage}</td></tr>`}</tbody></table>`;
}

function dailyPointPanel() {
  return `<article class="panel">
    <div class="panel-head"><h2>Point journalier</h2><span>Réservé administrateur - ${clean(currentYear())}</span></div>
    <div class="filters"><input id="dailyPointDate" type="date" value="${today()}" onchange="drawDailyPoint()"><button class="btn secondary" onclick="drawDailyPoint()">Actualiser</button></div>
    <div id="dailyPointTable"></div>
  </article>`;
}

function drawDailyPoint() {
  if (!$("dailyPointTable")) return;
  const date = $("dailyPointDate")?.value || today();
  const rows = state.payments.filter((row) => row.year === currentYear() && row.date === date);
  const studentIds = [...new Set(rows.map((row) => row.studentId))];
  const collected = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const t = totals();
  const byStudent = studentIds.map((id) => {
    const dayPayments = rows.filter((row) => row.studentId === id);
    return {
      row: student(id),
      dayAmount: dayPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      payers: [...new Set(dayPayments.map(paymentPayer))].join(", "),
      receipts: dayPayments.map((item) => item.id).join(", ")
    };
  });
  $("dailyPointTable").innerHTML = `<div class="mini-stats"><span>Enfants ayant payé : <b>${studentIds.length}</b></span><span>Montant du jour : <b class="amount-ok">${money(collected)}</b></span><span>Reste total : <b class="${t.remaining > 0 ? "amount-danger" : "amount-ok"}">${money(t.remaining)}</b></span></div><table><thead><tr><th>Élève</th><th>Classe</th><th>Reçus</th><th>Payé par</th><th>Montant jour</th><th>Total payé</th><th>Reste</th></tr></thead><tbody>${byStudent.map((item) => `<tr><td>${clean(item.row.name)}<br><small>${clean(item.row.matricule)}</small></td><td>${clean(item.row.className)}</td><td>${clean(item.receipts)}</td><td>${clean(item.payers || "-")}</td><td class="amount-ok">${money(item.dayAmount)}</td><td>${money(paid(item.row.id))}</td><td class="${balance(item.row.id) > 0 ? "amount-danger" : "amount-ok"}">${money(balance(item.row.id))}</td></tr>`).join("") || `<tr><td colspan="7">Aucun paiement enregistré pour cette date.</td></tr>`}</tbody></table>`;
}

function drawUnpaid() {
  if (!$("unpaidTable")) return;
  const rows = filterFinancialStudents("unpaid").sort((a, b) => balance(b.id) - balance(a.id));
  $("unpaidTable").innerHTML = `<p class="muted">${rows.length} élève(s) trouvé(s) selon les filtres.</p>${selectedPaymentStudent ? studentPaymentsPanel(selectedPaymentStudent) : ""}${financialRows(rows)}`;
}

function showStudentPayments(id) {
  selectedPaymentStudent = id;
  drawUnpaid();
}

function closeStudentPayments() {
  selectedPaymentStudent = null;
  drawUnpaid();
}

function studentPaymentsPanel(id) {
  const row = student(id);
  const rows = state.payments.filter((payment) => payment.studentId === id && payment.year === currentYear()).slice().reverse();
  return `<div class="installment-panel"><div class="panel-head"><h2>Versements de ${clean(row.name || "l'élève")}</h2><span>${clean(row.matricule || "")} · ${clean(currentYear())}</span></div><div class="mini-stats"><span>Frais prévus : <b>${money(due(id))}</b></span><span>Total payé : <b class="amount-ok">${money(paid(id))}</b></span><span>Reste : <b class="${balance(id) > 0 ? "amount-danger" : "amount-ok"}">${money(balance(id))}</b></span></div><table><thead><tr><th>Date</th><th>Reçu</th><th>Payé par</th><th>Montant</th><th>Total après</th><th>Reste après</th><th>Mode</th><th>Caissier</th><th>Action</th></tr></thead><tbody>${rows.map((payment) => { const amounts = receiptAmounts(payment); return `<tr><td>${clean(payment.date)}</td><td>${clean(payment.id)}</td><td>${clean(paymentPayer(payment))}</td><td class="amount-ok">${money(payment.amount)}</td><td>${money(amounts.totalPaid)}</td><td class="${amounts.remaining > 0 ? "amount-danger" : "amount-ok"}">${money(amounts.remaining)}</td><td>${clean(payment.mode)}</td><td>${clean(payment.cashier)}</td><td><button class="btn quiet small" onclick="openReceipt('${payment.id}')">Reçu</button></td></tr>`; }).join("") || `<tr><td colspan="9">Aucun versement enregistré pour cet élève.</td></tr>`}</tbody></table><div class="actions"><button class="btn quiet small" onclick="closeStudentPayments()">Fermer</button>${canAction("payments") ? ` <button class="btn secondary small" onclick="goPay('${id}')">Ajouter un versement</button>` : ""}</div></div>`;
}

function showDashboardDetail(type) {
  dashboardDetail = type;
  pages.dashboard();
}

function dashboardDetailPanel(type) {
  const title = type === "collected" ? "Détail du montant encaissé" : "Détail du reste à payer";
  const subtitle = type === "collected" ? "Liste des élèves qui ont payé" : "Liste filtrable des montants restants";
  return `<article class="panel"><div class="panel-head"><h2>${title}</h2><span>${subtitle}</span></div>${financialFilters("dash", type === "collected")}<div id="dashboardDetailTable"></div></article>`;
}

function drawDashboardDetail() {
  if (!$("dashboardDetailTable")) return;
  if (dashboardDetail === "collected") {
    const date = $("dashDate")?.value || "";
    const paidIds = new Set(state.payments.filter((row) => row.year === currentYear() && (!date || row.date === date)).map((row) => row.studentId));
    const rows = filterFinancialStudents("dash", state.students.filter((row) => paidIds.has(row.id))).sort((a, b) => paid(b.id) - paid(a.id));
    const paidTotal = rows.reduce((sum, row) => sum + paid(row.id), 0);
    $("dashboardDetailTable").innerHTML = `<div class="mini-stats"><span>Montant encaissé : <b class="amount-ok">${money(paidTotal)}</b></span><span>${rows.length} élèves avec paiement</span></div>${financialRows(rows, "Aucun paiement trouvé.")}`;
    return;
  }
  const rows = filterFinancialStudents("dash", state.students.filter((row) => balance(row.id) > 0)).sort((a, b) => balance(b.id) - balance(a.id));
  const remainingTotal = rows.reduce((sum, row) => sum + balance(row.id), 0);
  $("dashboardDetailTable").innerHTML = `<div class="mini-stats"><span>Reste à payer : <b class="amount-danger">${money(remainingTotal)}</b></span><span>${rows.length} élèves concernés</span></div>${financialRows(rows, "Aucun reste à payer.")}`;
}

function saveStudent() {
  if (!requireAction("students")) return;
  const name = $("stName").value.trim();
  if (!name) return alert("Le nom complet est obligatoire.");
  const data = { name, gender: $("stGender").value, birth: $("stBirth").value, addedDate: $("stAddedDate").value || today(), className: $("stClass").value, parent: $("stParent").value, phone: $("stPhone").value, address: $("stAddress").value, status: $("stStatus").value };
  if (editing) {
    Object.assign(state.students.find((row) => row.id === editing), data);
    log(`Élève modifié : ${name}`, "Élève");
  } else {
    const number = String(state.students.length + 1).padStart(4, "0");
    state.students.push({ id: uid("ELV"), matricule: `${state.school.code}-${currentYear().slice(0, 4)}-${number}`, ...data });
    log(`Élève ajouté : ${name}`, "Élève");
  }
  editing = null;
  saveState();
  pages.students();
}

function editStudent(id) { if (!requireAction("students")) return; editing = id; pages.students(); }
function deleteStudent(id) {
  if (!requireAction("students")) return;
  if (!confirm("Supprimer cet élève, ses inscriptions et ses paiements ?")) return;
  state.students = state.students.filter((row) => row.id !== id);
  state.enrollments = state.enrollments.filter((row) => row.studentId !== id);
  state.payments = state.payments.filter((row) => row.studentId !== id);
  log("Élève supprimé", "Élève");
  saveState();
  pages.students();
}

function quickEnroll(id) { if (!requireAction("enrollments")) return; showFinanceTab("enrollments"); $("enStudent").value = id; }

function saveClass() {
  if (!requireAction("classes")) return;
  const name = $("className").value.trim();
  if (!name) return alert("La classe est obligatoire.");
  const data = { name, level: $("level").value, fee: Number($("fee").value || 0) };
  if (editing) {
    Object.assign(state.classes.find((row) => row.id === editing), data);
    log(`Classe modifiée : ${name}`, "Classe");
  } else {
    state.classes.push({ id: uid("CLS"), ...data });
    log(`Classe ajoutée : ${name}`, "Classe");
  }
  editing = null;
  saveState();
  pages.classes();
}

function editClass(id) { if (!requireAction("classes")) return; editing = id; pages.classes(); }
function deleteClass(id) {
  if (!requireAction("classes")) return;
  if (!confirm("Supprimer cette classe ?")) return;
  state.classes = state.classes.filter((row) => row.id !== id);
  saveState();
  pages.classes();
}

function syncFee(force = false) {
  if ($("enAmount") && (force || !editingEnrollment)) $("enAmount").value = classFee(state.classes, $("enClass")?.value);
}

function saveEnrollment() {
  if (!requireAction("enrollments")) return;
  if (editingEnrollment && !requireAction("deleteEnrollments")) return;
  const enrollment = { id: editingEnrollment || uid("INS"), studentId: $("enStudent").value, className: $("enClass").value, year: $("enYear").value, amount: Number($("enAmount").value || 0), discount: Number($("enDiscount").value || 0), date: $("enDate").value, note: $("enNote").value };
  const fee = classFee(state.classes, enrollment.className);
  if (fee <= 0) return alert("Aucun frais n'est défini pour cette classe dans Classes & frais.");
  if (enrollment.amount <= 0) return alert("Le montant à payer doit être supérieur à zéro.");
  if (enrollment.amount > fee) return alert(`Le montant à payer ne peut pas dépasser les frais prévus pour la classe (${money(fee)}).`);
  if (enrollment.discount < 0) return alert("La remise ne peut pas être négative.");
  if (enrollment.discount > enrollment.amount) return alert("La remise ne peut pas dépasser le montant à payer.");
  const projected = state.enrollments.map((row) => row.id === enrollment.id ? enrollment : row);
  if (!editingEnrollment) projected.push(enrollment);
  const projectedDue = projected.filter((row) => row.studentId === enrollment.studentId && row.year === enrollment.year).reduce((sum, row) => sum + enrollmentNet(row), 0);
  if (projectedDue < paid(enrollment.studentId, enrollment.year)) return alert("Cette modification rendrait le montant dû inférieur au total déjà payé.");
  if (editingEnrollment) {
    Object.assign(state.enrollments.find((row) => row.id === editingEnrollment), enrollment);
  } else {
    state.enrollments.push(enrollment);
  }
  student(enrollment.studentId).className = enrollment.className;
  if (!state.years.includes(enrollment.year)) state.years.push(enrollment.year);
  state.activeYear = enrollment.year;
  log(`${editingEnrollment ? "Inscription modifiée" : "Inscription validée"} : ${student(enrollment.studentId).name}`, "Inscription");
  editingEnrollment = null;
  saveState();
  showFinanceTab("enrollments");
}

function enrollmentsTable() {
  const rows = state.enrollments.filter((row) => row.year === currentYear());
  return `<table><thead><tr><th>Élève</th><th>Classe</th><th>Année</th><th>Montant</th><th>Remise</th><th>Net</th><th>Date</th><th>Action</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${clean(student(row.studentId).name)}<br><small>${clean(student(row.studentId).matricule)}</small></td><td>${clean(row.className)}</td><td>${clean(row.year)}</td><td>${money(row.amount)}</td><td>${money(row.discount)}</td><td>${money(enrollmentNet(row))}</td><td>${clean(row.date)}</td><td>${canAction("deleteEnrollments") ? `<button class="btn quiet small" onclick="editEnrollment('${row.id}')">Modifier</button> <button class="btn danger small" onclick="deleteEnrollment('${row.id}')">Supprimer</button>` : `<span class="muted">Lecture seule</span>`}</td></tr>`).join("") || `<tr><td colspan="8">Aucune inscription pour cette année scolaire.</td></tr>`}</tbody></table>`;
}

function editEnrollment(id) {
  if (!requireAction("deleteEnrollments")) return;
  editingEnrollment = id;
  showFinanceTab("enrollments");
}

function deleteEnrollment(id) {
  if (!requireAction("deleteEnrollments")) return;
  if (!confirm("Supprimer cette inscription ?")) return;
  state.enrollments = state.enrollments.filter((row) => row.id !== id);
  log("Inscription supprimée", "Inscription");
  saveState();
  showFinanceTab("enrollments");
}

function paymentStudentMatches() {
  const q = ($("paySearch")?.value || "").toLowerCase().trim();
  const rows = q
    ? state.students.filter((row) => [row.name, row.matricule, row.parent, row.phone, row.className].join(" ").toLowerCase().includes(q))
    : state.students.slice(0, 8);
  return rows.slice(0, 8);
}

function drawPaymentStudentResults() {
  if (!$("payStudentResults")) return;
  const rows = paymentStudentMatches();
  $("payStudentResults").innerHTML = rows.map((row) => `<button type="button" class="${$("payStudent")?.value === row.id ? "active" : ""}" onclick="selectPaymentStudent('${row.id}')"><b>${clean(row.name)}</b><span>${clean(row.matricule)} · ${clean(row.className)} · reste ${money(balance(row.id))}</span><small>${clean(row.parent)} ${row.phone ? `· ${clean(row.phone)}` : ""}</small></button>`).join("") || `<div class="muted">Aucun élève trouvé.</div>`;
}

function selectPaymentStudent(id) {
  if ($("payStudent")) $("payStudent").value = id;
  const row = student(id);
  if ($("paySearch")) $("paySearch").value = `${row.name} - ${row.matricule}`;
  paymentInfo();
  drawPaymentStudentResults();
}

function paymentInfo() {
  const id = $("payStudent")?.value;
  if (id && $("paidBy") && !$("paidBy").value) $("paidBy").value = student(id).parent || "";
  if (id && $("payAmount")) {
    const left = Math.max(0, balance(id));
    $("payAmount").max = left;
    if (Number($("payAmount").value || 0) > left) $("payAmount").value = left;
  }
  if (id && $("payInfo")) $("payInfo").innerHTML = `Attendu : <b>${money(due(id))}</b> · Payé : <b>${money(paid(id))}</b> · Reste : <b>${money(balance(id))}</b>`;
}

function savePayment() {
  if (!requireAction("payments")) return;
  const studentId = $("payStudent").value;
  const amount = Number($("payAmount").value || 0);
  if (amount <= 0) return alert("Le montant doit être supérieur à zéro.");
  const expectedAtPayment = due(studentId);
  const paidBefore = paid(studentId);
  const balanceBefore = expectedAtPayment - paidBefore;
  if (expectedAtPayment <= 0) return alert("Aucun frais n'est défini pour cet élève sur l'année scolaire sélectionnée.");
  if (balanceBefore <= 0) return alert("Cet élève est déjà soldé pour cette année scolaire. Aucun nouveau reçu ne peut être créé.");
  if (balanceBefore > 0 && amount > balanceBefore) return alert(`Le montant saisi dépasse le reste à payer (${money(balanceBefore)}).`);
  const receipt = `${state.school.receiptPrefix}-${new Date().getFullYear()}-${String(state.payments.length + 1).padStart(4, "0")}`;
  const payment = { id: receipt, studentId, year: currentYear(), amount, expectedAtPayment, paidBefore, totalPaidAfter: paidBefore + amount, balanceAfter: expectedAtPayment - paidBefore - amount, paidBy: $("paidBy").value.trim() || student(studentId).parent || "", mode: $("payMode").value, date: $("payDate").value, cashier: $("cashier").value, note: $("payNote").value };
  state.payments.unshift(payment);
  activeReceipt = payment.id;
  log(`Paiement enregistré : ${student(studentId).name} - ${money(amount)}`, "Paiement", `Payé par : ${payment.paidBy || "-"}`);
  saveState();
  view = "receipts";
  renderNav();
  receiptView();
}

function paymentsTable() {
  const rows = state.payments.filter((row) => row.year === currentYear());
  return `<table><thead><tr><th>Reçu</th><th>Élève</th><th>Année</th><th>Payé par</th><th>Montant</th><th>Reste après paiement</th><th>Mode</th><th>Date</th><th>Caissier</th><th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${clean(row.id)}</td><td>${clean(student(row.studentId).name)}<br><small>${clean(student(row.studentId).matricule)}</small></td><td>${clean(row.year)}</td><td>${clean(paymentPayer(row))}</td><td>${money(row.amount)}</td><td class="${receiptAmounts(row).remaining > 0 ? "amount-danger" : "amount-ok"}">${money(receiptAmounts(row).remaining)}</td><td>${clean(row.mode)}</td><td>${clean(row.date)}<br><small>${clean(row.note)}</small></td><td>${clean(row.cashier)}</td><td><button class="btn quiet small" onclick="openReceipt('${row.id}')">Reçu</button>${canAction("deletePayments") ? ` <button class="btn danger small" onclick="deletePayment('${row.id}')">Supprimer</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="10">Aucun paiement pour cette année scolaire.</td></tr>`}</tbody></table>`;
}

function deletePayment(id) {
  if (!requireAction("deletePayments")) return;
  if (!confirm("Supprimer ce paiement ?")) return;
  state.payments = state.payments.filter((row) => row.id !== id);
  log("Paiement supprimé", "Paiement");
  saveState();
  showFinanceTab("payments");
}

function openReceipt(id) { activeReceipt = id; view = "receipts"; renderNav(); receiptView(); }

function receiptView() {
  const payment = state.payments.find((row) => row.id === activeReceipt) || state.payments[0];
  if (!payment) { $("content").innerHTML = `<article class="panel empty">Aucun reçu disponible.</article>`; return; }
  const row = student(payment.studentId);
  const amounts = receiptAmounts(payment);
  $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>Reçu de paiement</h2><span>${clean(payment.id)}</span></div><div class="receipt">${documentHeader("Reçu de paiement")}<div class="receipt-grid"><p><b>N° reçu</b><span>${clean(payment.id)}</span></p><p><b>Année scolaire</b><span>${clean(payment.year || currentYear())}</span></p><p><b>Date</b><span>${clean(payment.date)}</span></p><p><b>Élève</b><span>${clean(row.name)}</span></p><p><b>Matricule</b><span>${clean(row.matricule)}</span></p><p><b>Classe</b><span>${clean(row.className)}</span></p><p><b>Payé par</b><span>${clean(paymentPayer(payment))}</span></p><p><b>Mode</b><span>${clean(payment.mode)}</span></p><p><b>Frais classe</b><span>${money(amounts.expected)}</span></p><p><b>Déjà payé</b><span>${money(amounts.paidBefore)}</span></p><p><b>Montant payé</b><span>${money(amounts.currentPaid)}</span></p><p><b>Total payé</b><span>${money(amounts.totalPaid)}</span></p><p><b>Reste à payer</b><span class="${amounts.remaining > 0 ? "amount-danger" : "amount-ok"}">${money(amounts.remaining)}</span></p></div><p><b>Observation :</b> ${clean(payment.note || "-")}</p><div class="signatures"><p>Caissier<br><b>${clean(payment.cashier)}</b></p><p>Direction<br><b>${clean(state.school.director)}</b></p></div><small>${clean(state.school.receiptFooter)}</small></div><div class="actions"><button class="btn secondary" onclick="window.print()">Imprimer / PDF</button><button class="btn quiet" onclick="showFinanceTab('payments')">Retour paiements</button></div></article>`;
}

function goPay(id) { if (!requireAction("payments")) return; showFinanceTab("payments"); selectPaymentStudent(id); }

function genderSummary() {
  return `<table><thead><tr><th>Sexe</th><th>Élèves</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${genderTotals().map((row) => `<tr><td>${clean(row.label)}</td><td>${row.count}</td><td>${money(row.expected)}</td><td class="amount-ok">${money(row.collected)}</td><td class="${row.remaining > 0 ? "amount-danger" : "amount-ok"}">${money(row.remaining)}</td></tr>`).join("")}</tbody></table>`;
}

function classSummary() {
  return `<table><thead><tr><th>Classe</th><th>Niveau</th><th>Élèves</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${state.classes.map((row) => {
    const ids = state.students.filter((item) => item.className === row.name).map((item) => item.id);
    const expected = ids.reduce((sum, id) => sum + due(id), 0);
    const collected = ids.reduce((sum, id) => sum + paid(id), 0);
    return `<tr><td>${clean(row.name)}</td><td>${clean(row.level)}</td><td>${ids.length}</td><td>${money(expected)}</td><td>${money(collected)}</td><td class="${expected - collected > 0 ? "amount-danger" : "amount-ok"}">${money(expected - collected)}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function logsTable(limit) {
  const rows = normalizeLogs(state.logs).slice(0, limit);
  return `<table><thead><tr><th>Date</th><th>Type</th><th>Utilisateur</th><th>Rôle</th><th>Appareil</th><th>Action</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${clean(row.date)}</td><td>${clean(row.type)}</td><td>${clean(row.user)}</td><td>${clean(row.role || "-")}</td><td>${clean(row.device || "-")}</td><td>${clean(row.action)}${row.detail ? `<br><small>${clean(row.detail)}</small>` : ""}</td></tr>`).join("") || `<tr><td colspan="6">Aucune activité.</td></tr>`}</tbody></table>`;
}

function databaseOverview() {
  const t = totals();
  const rows = [
    ["Mode donnÃ©es", syncLabel()],
    ["AnnÃ©e active", currentYear()],
    ["Nom Ã©cole", state.school?.name || ""],
    ["Classes & frais", state.classes.length],
    ["Ã‰lÃ¨ves", state.students.length],
    ["Inscriptions", state.enrollments.length],
    ["Paiements / reÃ§us", state.payments.length],
    ["Utilisateurs", state.users.length],
    ["AnnÃ©es scolaires", state.years.length],
    ["Journaux de connexion et actions", state.logs.length],
    ["Montant attendu", money(t.expected)],
    ["Montant encaissÃ©", money(t.collected)],
    ["Reste Ã  payer", money(t.remaining)],
    ["DerniÃ¨re mise Ã  jour", state.updatedAt ? new Date(state.updatedAt).toLocaleString("fr-FR") : "-"]
  ];
  return `<table><thead><tr><th>Information</th><th>Valeur</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><td>${clean(label)}</td><td>${clean(value)}</td></tr>`).join("")}</tbody></table>`;
}

function saveUser() {
  if (!requireAction("users")) return;
  const data = { name: $("userName").value.trim(), login: $("userLogin").value.trim(), password: $("userPass").value, role: $("userRole").value, active: $("userActive").value === "true" };
  if (!data.name || !data.login || !data.password) return alert("Nom, identifiant et mot de passe sont obligatoires.");
  if (editing && session?.id === editing && !data.active) return alert("Vous ne pouvez pas verrouiller votre propre compte pendant cette session.");
  if (editing) {
    const activeAdmins = state.users.filter((row) => row.role === "Administrateur" && row.active && row.id !== editing).length;
    if ((!data.active || data.role !== "Administrateur") && state.users.find((row) => row.id === editing)?.role === "Administrateur" && activeAdmins === 0) return alert("Il faut conserver au moins un administrateur actif.");
  }
  if (editing) Object.assign(state.users.find((row) => row.id === editing), data);
  else state.users.push({ id: uid("USR"), ...data });
  log(`Utilisateur enregistré : ${data.login}`, "Utilisateur", data.role);
  editing = null;
  saveState();
  pages.users();
}

function editUser(id) { if (!requireAction("users")) return; editing = id; pages.users(); }
function toggleUserLock(id) {
  if (!requireAction("users")) return;
  const user = state.users.find((row) => row.id === id);
  if (!user) return;
  if (session?.id === id && user.active) return alert("Vous ne pouvez pas verrouiller votre propre compte pendant cette session.");
  const activeAdmins = state.users.filter((row) => row.role === "Administrateur" && row.active && row.id !== id).length;
  if (user.active && user.role === "Administrateur" && activeAdmins === 0) return alert("Il faut conserver au moins un administrateur actif.");
  user.active = !user.active;
  log(`${user.active ? "Utilisateur déverrouillé" : "Utilisateur verrouillé"} : ${user.login}`, "Utilisateur", user.role);
  saveState();
  pages.users();
}
function deleteUser(id) {
  if (!requireAction("users")) return;
  if (state.users.length <= 1) return alert("Il faut conserver au moins un utilisateur.");
  const user = state.users.find((row) => row.id === id);
  if (session?.id === id) return alert("Vous ne pouvez pas supprimer votre propre compte pendant cette session.");
  if (user?.role === "Administrateur" && state.users.filter((row) => row.role === "Administrateur" && row.active && row.id !== id).length === 0) return alert("Il faut conserver au moins un administrateur actif.");
  if (!confirm("Supprimer cet utilisateur ?")) return;
  state.users = state.users.filter((row) => row.id !== id);
  saveState();
  pages.users();
}

function saveSettings() {
  if (!requireAction("settings")) return;
  Object.assign(state.school, {
    name: $("schoolName").value,
    code: $("schoolCode").value,
    year: $("schoolYear").value,
    phone: $("schoolPhone").value,
    email: $("schoolEmail").value,
    address: $("schoolAddress").value,
    director: $("director").value,
    receiptPrefix: $("receiptPrefix").value,
    logo: $("logo").value,
    logoImage: LOGO_SRC,
    receiptFooter: $("receiptFooter").value
  });
  if (!state.years.includes(state.school.year)) state.years.push(state.school.year);
  state.activeYear = state.school.year;
  log("Paramètres enregistrés", "Paramètres");
  saveState();
  renderShell();
}

function exportCSV(type) {
  if (!requireAction("exports")) return;
  let rows = [];
  const year = currentYear();
  const yearPayments = state.payments.filter((row) => row.year === year);
  if (type === "students") rows = [["annee", "matricule", "nom", "date_ajout", "classe", "parent", "contact", "attendu", "paye", "reste"], ...state.students.map((row) => [year, row.matricule, row.name, row.addedDate || "", row.className, row.parent, row.phone, due(row.id), paid(row.id), balance(row.id)])];
  if (type === "payments") rows = [["annee", "recu", "eleve", "matricule", "paye_par", "montant", "mode", "date", "caissier"], ...yearPayments.map((row) => [row.year, row.id, student(row.studentId).name, student(row.studentId).matricule, paymentPayer(row), row.amount, row.mode, row.date, row.cashier])];
  if (type === "paidStudents") rows = [["annee", "matricule", "nom", "date_ajout", "classe", "parent", "contact", "attendu", "paye", "reste", "dernier_paye_par"], ...state.students.filter((row) => paid(row.id) > 0).map((row) => [year, row.matricule, row.name, row.addedDate || "", row.className, row.parent, row.phone, due(row.id), paid(row.id), balance(row.id), paymentPayer(lastPaymentForStudent(row.id))])];
  if (type === "noPaymentStudents") rows = [["annee", "matricule", "nom", "date_ajout", "classe", "parent", "contact", "attendu", "paye", "reste"], ...state.students.filter((row) => paid(row.id) <= 0).map((row) => [year, row.matricule, row.name, row.addedDate || "", row.className, row.parent, row.phone, due(row.id), paid(row.id), balance(row.id)])];
  if (type === "unpaid") rows = [["annee", "matricule", "nom", "date_ajout", "classe", "parent", "contact", "attendu", "paye", "reste", "statut", "dernier_paye_par"], ...state.students.map((row) => [year, row.matricule, row.name, row.addedDate || "", row.className, row.parent, row.phone, due(row.id), paid(row.id), balance(row.id), financeStatus(row), lastPaymentForStudent(row.id) ? paymentPayer(lastPaymentForStudent(row.id)) : ""])];
  if (type === "logs") rows = [["date", "iso", "type", "utilisateur", "role", "appareil", "action", "detail"], ...normalizeLogs(state.logs).map((row) => [row.date, row.iso, row.type, row.user, row.role, row.device, row.action, row.detail])];
  log(`Export CSV : ${type}`, "Export");
  download(`${type}.csv`, rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8");
}

function downloadBackup() {
  if (!requireAction("backup")) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const payload = {
    app: "MIENRA Web",
    school: state.school?.name || SCHOOL_IDENTITY.name,
    version: ASSET_VERSION,
    exportedAt: new Date().toISOString(),
    data: normalizeState(state)
  };
  log("Export sauvegarde JSON complet", "Sauvegarde");
  download(`mienra-base-complete-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function removeDemoData() {
  if (!requireAction("backup")) return;
  const demoMatricules = new Set(["GSM-2026-0001", "GSM-2026-0002", "GSM-2026-0003"]);
  const demoNames = new Set(["Aka Mireille", "Kouadio Jean", "TraorÃ© Aminata"]);
  const demoReceipts = new Set(["REC-2026-0001", "REC-2026-0002"]);
  const demoStudentIds = new Set(state.students.filter((row) => demoMatricules.has(row.matricule) || demoNames.has(row.name)).map((row) => row.id));
  const demoPaymentIds = new Set(state.payments.filter((row) => demoStudentIds.has(row.studentId) || demoReceipts.has(row.id)).map((row) => row.id));
  const count = demoStudentIds.size + demoPaymentIds.size + state.enrollments.filter((row) => demoStudentIds.has(row.studentId)).length;
  if (!count) return alert("Aucune donnÃ©e de dÃ©monstration connue trouvÃ©e.");
  if (!confirm(`Supprimer ${count} Ã©lÃ©ment(s) de dÃ©monstration connu(s) ?`)) return;
  state.students = state.students.filter((row) => !demoStudentIds.has(row.id));
  state.enrollments = state.enrollments.filter((row) => !demoStudentIds.has(row.studentId));
  state.payments = state.payments.filter((row) => !demoPaymentIds.has(row.id));
  log("DonnÃ©es de dÃ©monstration supprimÃ©es", "Sauvegarde", `${demoStudentIds.size} Ã©lÃ¨ve(s), ${demoPaymentIds.size} paiement(s)`);
  saveState();
  renderShell();
  go("backup");
}

function restoreLocalBackup() {
  if (!requireAction("backup")) return;
  const saved = localStorage.getItem(DB_BACKUP_KEY);
  if (!saved) return alert("Aucune copie locale de secours trouvée sur ce navigateur.");
  if (!confirm("Restaurer la dernière copie locale de secours ?")) return;
  try {
    state = mergeStates(state, JSON.parse(saved));
    state.updatedAt = new Date().toISOString();
    saveLocalState();
    pushSharedState();
    log("Copie locale restaurée", "Sauvegarde");
    renderShell();
  } catch {
    alert("La copie locale de secours est invalide.");
  }
}

function download(name, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importBackup(input) {
  if (!requireAction("backup")) return;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = normalizeState(parsed.data || parsed);
      saveState();
      log("Sauvegarde importée", "Sauvegarde");
      renderShell();
    } catch {
      alert("Fichier JSON invalide.");
    }
  };
  reader.readAsText(file);
}

function resetApp() {
  if (!requireAction("backup")) return;
  if (!confirm("Réinitialiser les données de l'application ?")) return;
  state = cloudEnabled() ? blankState() : seedState();
  log("Réinitialisation des données", "Sauvegarde");
  renderShell();
}

init();
