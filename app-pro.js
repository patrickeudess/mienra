const DB_KEY = "mienra_web_app_v2";

const $ = (id) => document.getElementById(id);
const LOGO_SRC = "assets/mienra-logo.jpeg";
const ASSET_VERSION = "20260706-logo-docs";
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
let activeReceipt = null;
let state = loadState();

const menu = [
  ["dashboard", "Tableau de bord", "◼"],
  ["students", "Élèves", "●"],
  ["classes", "Classes & frais", "▦"],
  ["enrollments", "Inscriptions", "✓"],
  ["payments", "Paiements", "+"],
  ["receipts", "Reçus", "#"],
  ["unpaid", "Impayés", "!"],
  ["reports", "Rapports", "▤"],
  ["users", "Utilisateurs", "◎"],
  ["settings", "Paramètres", "⚙"],
  ["backup", "Sauvegardes", "⇩"]
];

const roleAccess = {
  Administrateur: {
    pages: ["dashboard", "students", "classes", "enrollments", "payments", "receipts", "unpaid", "reports", "users", "settings", "backup"],
    actions: ["students", "classes", "enrollments", "payments", "users", "settings", "backup", "exports"]
  },
  Directeur: {
    pages: ["dashboard", "students", "classes", "enrollments", "payments", "receipts", "unpaid", "reports", "settings"],
    actions: ["students", "classes", "enrollments", "payments", "settings", "exports"]
  },
  Secrétaire: {
    pages: ["dashboard", "students", "enrollments", "payments", "receipts", "unpaid"],
    actions: ["students", "enrollments", "payments"]
  },
  Consultation: {
    pages: ["dashboard", "students", "receipts", "unpaid", "reports"],
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

  const students = [
    { id: uid("ELV"), matricule: "GSM-2026-0001", name: "Aka Mireille", gender: "F", birth: "2014-04-12", className: "6e", parent: "Aka Paul", phone: "0700000001", address: "Yopougon", status: "Actif" },
    { id: uid("ELV"), matricule: "GSM-2026-0002", name: "Kouadio Jean", gender: "M", birth: "2015-09-20", className: "CM2", parent: "Kouadio Anne", phone: "0700000002", address: "Cocody", status: "Actif" },
    { id: uid("ELV"), matricule: "GSM-2026-0003", name: "Traoré Aminata", gender: "F", birth: "2012-01-11", className: "4e", parent: "Traoré Moussa", phone: "0700000003", address: "Abobo", status: "Actif" }
  ];

  return {
    school: {
      name: "Groupe Scolaire MIENRA",
      code: "GSM",
      year: "2026-2027",
      phone: "+225 07 00 00 00 00",
      email: "contact@mienra.ci",
      address: "Abidjan, Côte d’Ivoire",
      director: "Directeur de l’école",
      logo: "M",
      logoImage: LOGO_SRC,
      receiptPrefix: "REC",
      receiptFooter: "Merci pour votre paiement."
    },
    years: ["2025-2026", "2026-2027"],
    users: [
      { id: uid("USR"), name: "Administrateur", login: "admin", password: "admin123", role: "Administrateur", active: true },
      { id: uid("USR"), name: "Directeur", login: "directeur", password: "directeur123", role: "Directeur", active: true },
      { id: uid("USR"), name: "Secrétaire", login: "secretaire", password: "secretaire123", role: "Secrétaire", active: true },
      { id: uid("USR"), name: "Consultation", login: "consultation", password: "consultation123", role: "Consultation", active: true }
    ],
    classes,
    students,
    enrollments: students.map((student) => ({
      id: uid("INS"),
      studentId: student.id,
      year: "2026-2027",
      className: student.className,
      amount: classFee(classes, student.className),
      discount: 0,
      date: today(),
      note: "Inscription annuelle"
    })),
    payments: [
      { id: "REC-2026-0001", studentId: students[0].id, amount: 180000, mode: "Espèces", date: today(), cashier: "Secrétaire", note: "Paiement complet" },
      { id: "REC-2026-0002", studentId: students[1].id, amount: 100000, mode: "Mobile Money", date: today(), cashier: "Secrétaire", note: "Premier versement" }
    ],
    logs: [],
    backups: []
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY));
    return saved ? normalizeState(saved) : seedState();
  } catch {
    return seedState();
  }
}

function normalizeState(data) {
  const base = seedState();
  return {
    ...base,
    ...data,
    school: { ...base.school, ...(data.school || {}) },
    years: data.years?.length ? data.years : base.years,
    users: data.users?.length ? data.users : base.users,
    logs: data.logs || []
  };
}

function saveState() { localStorage.setItem(DB_KEY, JSON.stringify(state)); }
function log(action) {
  state.logs.unshift({ date: new Date().toLocaleString("fr-FR"), user: session?.name || "Système", action });
  state.logs = state.logs.slice(0, 300);
  saveState();
}

function classFee(classes, name) { return Number(classes.find((item) => item.name === name)?.fee || 0); }
function student(id) { return state.students.find((item) => item.id === id) || {}; }
function due(id) { return state.enrollments.filter((item) => item.studentId === id).reduce((sum, item) => sum + Number(item.amount || 0) - Number(item.discount || 0), 0); }
function paid(id) { return state.payments.filter((item) => item.studentId === id).reduce((sum, item) => sum + Number(item.amount || 0), 0); }
function balance(id) { return due(id) - paid(id); }
function percent(id) { const total = due(id); return total ? Math.min(100, Math.round((paid(id) / total) * 100)) : 0; }
function totals() {
  const expected = state.students.reduce((sum, item) => sum + due(item.id), 0);
  const collected = state.students.reduce((sum, item) => sum + paid(item.id), 0);
  return { expected, collected, remaining: expected - collected, rate: expected ? Math.round((collected / expected) * 100) : 0 };
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
        <div class="login-brand"><img class="brand-logo" src="${logoUrl()}" alt="Logo MIENRA"><div><h1>MIENRA Web</h1><p>Gestion scolaire testable par lien GitHub Pages.</p></div></div>
        <label>Identifiant</label><input id="login" value="admin" autocomplete="username">
        <label>Mot de passe</label><input id="password" type="password" value="admin123" autocomplete="current-password">
        <div class="actions"><button class="btn primary" onclick="login()">Se connecter</button><button class="btn quiet" onclick="quickLogin()">Mode démo</button></div>
        <div class="hint">Comptes test : admin/admin123, directeur/directeur123, secretaire/secretaire123, consultation/consultation123</div>
      </div>
    </section>`;
}

function login() {
  const username = $("login").value.trim();
  const password = $("password").value.trim();
  const user = state.users.find((item) => item.login === username && item.password === password && item.active);
  if (!user) return alert("Identifiants incorrects ou compte inactif.");
  session = user;
  log("Connexion");
  renderShell();
}

function quickLogin() {
  session = state.users.find((item) => item.login === "admin") || state.users[0];
  log("Connexion démo");
  renderShell();
}

function logout() { session = null; renderLogin(); }

function renderShell() {
  ensureAllowedView();
  $("root").innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand-row"><img class="brand-logo small-logo" src="${logoUrl()}" alt="Logo MIENRA"><div><strong>MIENRA</strong><span>${clean(state.school.year)}</span></div></div>
        <div class="account"><b>${clean(session.name)}</b><span>${clean(session.role)}</span><button class="btn small quiet" onclick="logout()">Déconnexion</button></div>
        <nav id="nav"></nav>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div><p>${clean(state.school.name)}</p><h1 id="pageTitle"></h1></div>
          <div class="top-actions">${canPage("backup") ? `<button class="btn quiet" onclick="go('backup')">Sauvegardes</button>` : ""}${canAction("payments") ? `<button class="btn secondary" onclick="go('payments')">Nouveau paiement</button>` : ""}</div>
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
  if (!canPage(key)) return alert("Accès refusé pour ce rôle.");
  view = key;
  editing = null;
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
      <div class="stats">${stat("Élèves", state.students.length)}${stat("Montant attendu", money(t.expected))}${stat("Montant encaissé", money(t.collected))}${stat("Reste à payer", money(t.remaining), t.remaining > 0 ? "danger" : "ok")}</div>
      <div class="layout-two">
        <article class="panel"><div class="panel-head"><h2>Recouvrement par classe</h2><span>${t.rate}% encaissé</span></div>${classSummary()}</article>
        <article class="panel"><div class="panel-head"><h2>Activité récente</h2><span>${state.logs.length} opérations</span></div>${logsTable(9)}</article>
      </div>`;
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
  enrollments() {
    $("content").innerHTML = `
      ${canAction("enrollments") ? `<article class="panel"><div class="panel-head"><h2>Nouvelle inscription</h2><span>Création d’un droit scolaire</span></div><div class="form-grid"><div><label>Élève</label><select id="enStudent">${state.students.map((row) => `<option value="${row.id}">${clean(row.name)} - ${clean(row.matricule)}</option>`).join("")}</select></div><div><label>Classe</label><select id="enClass" onchange="syncFee()">${state.classes.map((row) => `<option>${clean(row.name)}</option>`).join("")}</select></div><div><label>Année</label><select id="enYear">${state.years.map((year) => `<option ${year === state.school.year ? "selected" : ""}>${clean(year)}</option>`).join("")}</select></div>${field("Montant", "enAmount", "", "number")}${field("Remise", "enDiscount", 0, "number")}${field("Date", "enDate", today(), "date")}</div>${field("Note", "enNote", "Inscription annuelle")}<div class="actions"><button class="btn primary" onclick="saveEnrollment()">Valider l’inscription</button></div></article>` : readOnlyNotice("Inscriptions")}
      <article class="panel"><div class="panel-head"><h2>Historique des inscriptions</h2><span>${state.enrollments.length} lignes</span></div>${enrollmentsTable()}</article>`;
    syncFee();
  },
  payments() {
    $("content").innerHTML = `
      ${canAction("payments") ? `<article class="panel"><div class="panel-head"><h2>Nouveau paiement</h2><span>Encaissement et reçu</span></div><div class="form-grid"><div><label>Élève</label><select id="payStudent" onchange="paymentInfo()">${state.students.map((row) => `<option value="${row.id}">${clean(row.name)} - reste ${money(balance(row.id))}</option>`).join("")}</select></div>${field("Montant payé", "payAmount", 50000, "number")}<div><label>Mode</label><select id="payMode"><option>Espèces</option><option>Mobile Money</option><option>Chèque</option><option>Virement</option><option>Carte bancaire</option></select></div>${field("Date", "payDate", today(), "date")}${field("Caissier", "cashier", session.name)}${field("Note", "payNote", "Versement frais scolaires")}</div><div class="notice" id="payInfo"></div><div class="actions"><button class="btn primary" onclick="savePayment()">Enregistrer et générer le reçu</button></div></article>` : readOnlyNotice("Paiements")}
      <article class="panel"><div class="panel-head"><h2>Historique des paiements</h2><span>${state.payments.length} reçus</span></div>${paymentsTable()}</article>`;
    paymentInfo();
  },
  receipts() { receiptView(); },
  unpaid() {
    const rows = state.students.filter((row) => balance(row.id) > 0).sort((a, b) => balance(b.id) - balance(a.id));
    $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>Impayés</h2><span>${money(rows.reduce((sum, row) => sum + balance(row.id), 0))} à recouvrer</span></div><table><thead><tr><th>Élève</th><th>Classe</th><th>Attendu</th><th>Payé</th><th>Reste</th><th>Parent</th><th>Action</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${clean(row.name)}<br><small>${clean(row.matricule)}</small></td><td>${clean(row.className)}</td><td>${money(due(row.id))}</td><td>${money(paid(row.id))}</td><td class="amount-danger">${money(balance(row.id))}</td><td>${clean(row.parent)}<br><small>${clean(row.phone)}</small></td><td>${canAction("payments") ? `<button class="btn secondary small" onclick="goPay('${row.id}')">Payer</button>` : `<span class="muted">Lecture seule</span>`}</td></tr>`).join("") || `<tr><td colspan="7">Aucun impayé.</td></tr>`}</tbody></table></article>`;
  },
  reports() {
    const t = totals();
    $("content").innerHTML = `<article class="panel printable-document">${documentHeader("Rapport financier")}<div class="stats">${stat("Attendu", money(t.expected))}${stat("Encaissé", money(t.collected))}${stat("Impayés", money(t.remaining), "danger")}${stat("Taux", `${t.rate}%`)}</div></article><article class="panel"><div class="panel-head"><h2>Exports et impression</h2><span>Données du navigateur</span></div><div class="actions">${canAction("exports") ? `<button class="btn secondary" onclick="exportCSV('students')">Exporter élèves CSV</button><button class="btn secondary" onclick="exportCSV('payments')">Exporter paiements CSV</button><button class="btn secondary" onclick="exportCSV('unpaid')">Exporter impayés CSV</button>` : ""}<button class="btn quiet" onclick="window.print()">Imprimer le rapport</button></div></article><article class="panel printable-document"><div class="panel-head"><h2>Rapport par classe</h2><span>Synthèse financière</span></div>${classSummary()}</article>`;
  },
  users() {
    const item = editing ? state.users.find((row) => row.id === editing) : {};
    $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>${editing ? "Modifier un utilisateur" : "Ajouter un utilisateur"}</h2><span>Comptes locaux de test</span></div><div class="form-grid">${field("Nom", "userName", item?.name || "")}${field("Identifiant", "userLogin", item?.login || "")}${field("Mot de passe", "userPass", item?.password || "123456")}<div><label>Rôle</label><select id="userRole">${["Administrateur", "Directeur", "Secrétaire", "Consultation"].map((role) => `<option ${item?.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></div><div><label>Statut</label><select id="userActive"><option value="true" ${item?.active !== false ? "selected" : ""}>Actif</option><option value="false" ${item?.active === false ? "selected" : ""}>Inactif</option></select></div></div><div class="actions"><button class="btn primary" onclick="saveUser()">Enregistrer</button></div></article><article class="panel"><div class="panel-head"><h2>Utilisateurs</h2><span>${state.users.length} comptes</span></div><table><thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${state.users.map((row) => `<tr><td>${clean(row.name)}</td><td>${clean(row.login)}</td><td>${clean(row.role)}</td><td>${row.active ? "Actif" : "Inactif"}</td><td>${rowActions("User", row.id)}</td></tr>`).join("")}</tbody></table></article>`;
  },
  settings() {
    const item = state.school;
    $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>Paramètres de l’établissement</h2><span>Identité sur reçus et exports</span></div><div class="settings-logo"><img src="${logoUrl()}" alt="Logo MIENRA"><span>Logo officiel utilisé sur les reçus et documents imprimables.</span></div><div class="form-grid">${field("Nom école", "schoolName", item.name)}${field("Code", "schoolCode", item.code)}${field("Année active", "schoolYear", item.year)}${field("Téléphone", "schoolPhone", item.phone)}${field("Email", "schoolEmail", item.email)}${field("Adresse", "schoolAddress", item.address)}${field("Directeur", "director", item.director)}${field("Préfixe reçu", "receiptPrefix", item.receiptPrefix)}${field("Logo texte secours", "logo", item.logo)}</div><div><label>Message reçu</label><textarea id="receiptFooter">${clean(item.receiptFooter)}</textarea></div><div class="actions"><button class="btn primary" onclick="saveSettings()">Enregistrer les paramètres</button></div></article>`;
  },
  backup() {
    $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>Sauvegardes</h2><span>Export/import JSON</span></div><p class="muted">Cette version GitHub Pages stocke les données dans le navigateur de chaque testeur. Exportez un fichier JSON pour transférer ou archiver une base de test.</p><div class="actions"><button class="btn secondary" onclick="downloadBackup()">Exporter JSON</button><button class="btn danger" onclick="resetApp()">Réinitialiser</button></div><label>Importer une sauvegarde JSON</label><input type="file" accept=".json" onchange="importBackup(this)"></article><article class="panel"><div class="panel-head"><h2>Journal</h2><span>${state.logs.length} opérations</span></div>${logsTable(80)}</article>`;
  }
};

function stat(label, value, tone = "") { return `<div class="stat ${tone}"><span>${label}</span><strong>${value}</strong></div>`; }
function field(label, id, value = "", type = "text") { return `<div><label>${label}</label><input id="${id}" type="${type}" value="${clean(value)}"></div>`; }
function documentHeader(title = state.school.name) {
  return `<div class="document-header"><img class="document-logo" src="${logoUrl()}" alt="Logo MIENRA"><div><h2>${clean(title)}</h2><p>${clean(state.school.name)} · ${clean(state.school.address)} · ${clean(state.school.phone)} · ${clean(state.school.email)}</p></div></div>`;
}
function readOnlyNotice(label) { return `<article class="panel notice">${label} : affichage en lecture seule pour le rôle ${clean(session?.role || "")}.</article>`; }
function actionForScope(scope) { return ({ Class: "classes", User: "users" })[scope]; }
function rowActions(scope, id) {
  if (!canAction(actionForScope(scope))) return `<span class="muted">Lecture seule</span>`;
  return `<button class="btn quiet small" onclick="edit${scope}('${id}')">Modifier</button> <button class="btn danger small" onclick="delete${scope}('${id}')">Supprimer</button>`;
}

function studentForm(item) {
  return `<div class="form-grid">${field("Nom complet", "stName", item?.name || "")}<div><label>Genre</label><select id="stGender"><option ${item?.gender === "M" ? "selected" : ""}>M</option><option ${item?.gender === "F" ? "selected" : ""}>F</option></select></div>${field("Date naissance", "stBirth", item?.birth || "", "date")}<div><label>Classe</label><select id="stClass">${state.classes.map((row) => `<option ${item?.className === row.name ? "selected" : ""}>${clean(row.name)}</option>`).join("")}</select></div>${field("Parent/Tuteur", "stParent", item?.parent || "")}${field("Contact", "stPhone", item?.phone || "")}${field("Adresse", "stAddress", item?.address || "")}<div><label>Statut</label><select id="stStatus">${["Actif", "Inactif", "Transféré"].map((status) => `<option ${item?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div></div>`;
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
  $("studentsTable").innerHTML = `<table><thead><tr><th>Matricule</th><th>Élève</th><th>Classe</th><th>Parent</th><th>Paiement</th><th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${clean(row.matricule)}</td><td>${clean(row.name)}<br><small>${clean(row.gender)} · ${clean(row.status)}</small></td><td>${clean(row.className)}</td><td>${clean(row.parent)}<br><small>${clean(row.phone)}</small></td><td>${paymentStatus(row)}</td><td>${studentActions(row.id)}</td></tr>`).join("") || `<tr><td colspan="6">Aucun élève trouvé.</td></tr>`}</tbody></table>`;
}

function studentActions(id) {
  const actions = [];
  if (canAction("students")) actions.push(`<button class="btn quiet small" onclick="editStudent('${id}')">Modifier</button>`, `<button class="btn danger small" onclick="deleteStudent('${id}')">Supprimer</button>`);
  if (canAction("enrollments")) actions.splice(1, 0, `<button class="btn secondary small" onclick="quickEnroll('${id}')">Inscrire</button>`);
  return actions.length ? actions.join(" ") : `<span class="muted">Lecture seule</span>`;
}

function paymentStatus(row) {
  const left = balance(row.id);
  const collected = paid(row.id);
  const label = left <= 0 ? "Soldé" : collected > 0 ? "Partiel" : "Impayé";
  const tone = left <= 0 ? "amount-ok" : collected > 0 ? "amount-warn" : "amount-danger";
  return `<b class="${tone}">${label}</b><div class="progress"><span style="width:${percent(row.id)}%"></span></div><small>${percent(row.id)}% · reste ${money(left)}</small>`;
}

function saveStudent() {
  if (!requireAction("students")) return;
  const name = $("stName").value.trim();
  if (!name) return alert("Le nom complet est obligatoire.");
  const data = { name, gender: $("stGender").value, birth: $("stBirth").value, className: $("stClass").value, parent: $("stParent").value, phone: $("stPhone").value, address: $("stAddress").value, status: $("stStatus").value };
  if (editing) {
    Object.assign(state.students.find((row) => row.id === editing), data);
    log(`Élève modifié : ${name}`);
  } else {
    const number = String(state.students.length + 1).padStart(4, "0");
    state.students.push({ id: uid("ELV"), matricule: `${state.school.code}-${state.school.year.slice(0, 4)}-${number}`, ...data });
    log(`Élève ajouté : ${name}`);
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
  log("Élève supprimé");
  saveState();
  pages.students();
}

function quickEnroll(id) { if (!requireAction("enrollments")) return; view = "enrollments"; renderNav(); pages.enrollments(); $("enStudent").value = id; }

function saveClass() {
  if (!requireAction("classes")) return;
  const name = $("className").value.trim();
  if (!name) return alert("La classe est obligatoire.");
  const data = { name, level: $("level").value, fee: Number($("fee").value || 0) };
  if (editing) {
    Object.assign(state.classes.find((row) => row.id === editing), data);
    log(`Classe modifiée : ${name}`);
  } else {
    state.classes.push({ id: uid("CLS"), ...data });
    log(`Classe ajoutée : ${name}`);
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

function syncFee() { if ($("enAmount")) $("enAmount").value = classFee(state.classes, $("enClass")?.value); }

function saveEnrollment() {
  if (!requireAction("enrollments")) return;
  const enrollment = { id: uid("INS"), studentId: $("enStudent").value, className: $("enClass").value, year: $("enYear").value, amount: Number($("enAmount").value || 0), discount: Number($("enDiscount").value || 0), date: $("enDate").value, note: $("enNote").value };
  state.enrollments.push(enrollment);
  student(enrollment.studentId).className = enrollment.className;
  if (!state.years.includes(enrollment.year)) state.years.push(enrollment.year);
  log(`Inscription validée : ${student(enrollment.studentId).name}`);
  saveState();
  pages.enrollments();
}

function enrollmentsTable() {
  return `<table><thead><tr><th>Élève</th><th>Classe</th><th>Année</th><th>Montant</th><th>Remise</th><th>Net</th><th>Date</th><th>Action</th></tr></thead><tbody>${state.enrollments.map((row) => `<tr><td>${clean(student(row.studentId).name)}<br><small>${clean(student(row.studentId).matricule)}</small></td><td>${clean(row.className)}</td><td>${clean(row.year)}</td><td>${money(row.amount)}</td><td>${money(row.discount)}</td><td>${money(row.amount - row.discount)}</td><td>${clean(row.date)}</td><td>${canAction("enrollments") ? `<button class="btn danger small" onclick="deleteEnrollment('${row.id}')">Supprimer</button>` : `<span class="muted">Lecture seule</span>`}</td></tr>`).join("")}</tbody></table>`;
}

function deleteEnrollment(id) {
  if (!requireAction("enrollments")) return;
  if (!confirm("Supprimer cette inscription ?")) return;
  state.enrollments = state.enrollments.filter((row) => row.id !== id);
  log("Inscription supprimée");
  saveState();
  pages.enrollments();
}

function paymentInfo() {
  const id = $("payStudent")?.value;
  if (id && $("payInfo")) $("payInfo").innerHTML = `Attendu : <b>${money(due(id))}</b> · Payé : <b>${money(paid(id))}</b> · Reste : <b>${money(balance(id))}</b>`;
}

function savePayment() {
  if (!requireAction("payments")) return;
  const studentId = $("payStudent").value;
  const amount = Number($("payAmount").value || 0);
  if (amount <= 0) return alert("Le montant doit être supérieur à zéro.");
  const receipt = `${state.school.receiptPrefix}-${new Date().getFullYear()}-${String(state.payments.length + 1).padStart(4, "0")}`;
  const payment = { id: receipt, studentId, amount, mode: $("payMode").value, date: $("payDate").value, cashier: $("cashier").value, note: $("payNote").value };
  state.payments.unshift(payment);
  activeReceipt = payment.id;
  log(`Paiement enregistré : ${student(studentId).name} - ${money(amount)}`);
  saveState();
  view = "receipts";
  renderNav();
  receiptView();
}

function paymentsTable() {
  return `<table><thead><tr><th>Reçu</th><th>Élève</th><th>Montant</th><th>Mode</th><th>Date</th><th>Caissier</th><th>Actions</th></tr></thead><tbody>${state.payments.map((row) => `<tr><td>${clean(row.id)}</td><td>${clean(student(row.studentId).name)}<br><small>${clean(student(row.studentId).matricule)}</small></td><td>${money(row.amount)}</td><td>${clean(row.mode)}</td><td>${clean(row.date)}<br><small>${clean(row.note)}</small></td><td>${clean(row.cashier)}</td><td><button class="btn quiet small" onclick="openReceipt('${row.id}')">Reçu</button>${canAction("payments") ? ` <button class="btn danger small" onclick="deletePayment('${row.id}')">Supprimer</button>` : ""}</td></tr>`).join("")}</tbody></table>`;
}

function deletePayment(id) {
  if (!requireAction("payments")) return;
  if (!confirm("Supprimer ce paiement ?")) return;
  state.payments = state.payments.filter((row) => row.id !== id);
  log("Paiement supprimé");
  saveState();
  pages.payments();
}

function openReceipt(id) { activeReceipt = id; view = "receipts"; renderNav(); receiptView(); }

function receiptView() {
  const payment = state.payments.find((row) => row.id === activeReceipt) || state.payments[0];
  if (!payment) { $("content").innerHTML = `<article class="panel empty">Aucun reçu disponible.</article>`; return; }
  const row = student(payment.studentId);
  $("content").innerHTML = `<article class="panel"><div class="panel-head"><h2>Reçu de paiement</h2><span>${clean(payment.id)}</span></div><div class="receipt">${documentHeader("Reçu de paiement")}<div class="receipt-grid"><p><b>N° reçu</b><span>${clean(payment.id)}</span></p><p><b>Date</b><span>${clean(payment.date)}</span></p><p><b>Élève</b><span>${clean(row.name)}</span></p><p><b>Matricule</b><span>${clean(row.matricule)}</span></p><p><b>Classe</b><span>${clean(row.className)}</span></p><p><b>Mode</b><span>${clean(payment.mode)}</span></p><p><b>Montant payé</b><span>${money(payment.amount)}</span></p><p><b>Reste</b><span>${money(balance(row.id))}</span></p></div><p><b>Observation :</b> ${clean(payment.note || "-")}</p><div class="signatures"><p>Caissier<br><b>${clean(payment.cashier)}</b></p><p>Direction<br><b>${clean(state.school.director)}</b></p></div><small>${clean(state.school.receiptFooter)}</small></div><div class="actions"><button class="btn secondary" onclick="window.print()">Imprimer / PDF</button><button class="btn quiet" onclick="go('payments')">Retour paiements</button></div></article>`;
}

function goPay(id) { if (!requireAction("payments")) return; view = "payments"; renderNav(); pages.payments(); $("payStudent").value = id; paymentInfo(); }

function classSummary() {
  return `<table><thead><tr><th>Classe</th><th>Niveau</th><th>Élèves</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${state.classes.map((row) => {
    const ids = state.students.filter((item) => item.className === row.name).map((item) => item.id);
    const expected = ids.reduce((sum, id) => sum + due(id), 0);
    const collected = ids.reduce((sum, id) => sum + paid(id), 0);
    return `<tr><td>${clean(row.name)}</td><td>${clean(row.level)}</td><td>${ids.length}</td><td>${money(expected)}</td><td>${money(collected)}</td><td class="${expected - collected > 0 ? "amount-danger" : "amount-ok"}">${money(expected - collected)}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function logsTable(limit) {
  return `<table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th></tr></thead><tbody>${state.logs.slice(0, limit).map((row) => `<tr><td>${clean(row.date)}</td><td>${clean(row.user)}</td><td>${clean(row.action)}</td></tr>`).join("") || `<tr><td colspan="3">Aucune activité.</td></tr>`}</tbody></table>`;
}

function saveUser() {
  if (!requireAction("users")) return;
  const data = { name: $("userName").value.trim(), login: $("userLogin").value.trim(), password: $("userPass").value, role: $("userRole").value, active: $("userActive").value === "true" };
  if (!data.name || !data.login || !data.password) return alert("Nom, identifiant et mot de passe sont obligatoires.");
  if (editing) Object.assign(state.users.find((row) => row.id === editing), data);
  else state.users.push({ id: uid("USR"), ...data });
  log(`Utilisateur enregistré : ${data.login}`);
  editing = null;
  saveState();
  pages.users();
}

function editUser(id) { if (!requireAction("users")) return; editing = id; pages.users(); }
function deleteUser(id) {
  if (!requireAction("users")) return;
  if (state.users.length <= 1) return alert("Il faut conserver au moins un utilisateur.");
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
  log("Paramètres enregistrés");
  saveState();
  renderShell();
}

function exportCSV(type) {
  if (!requireAction("exports")) return;
  let rows = [];
  if (type === "students") rows = [["matricule", "nom", "classe", "parent", "contact", "attendu", "paye", "reste"], ...state.students.map((row) => [row.matricule, row.name, row.className, row.parent, row.phone, due(row.id), paid(row.id), balance(row.id)])];
  if (type === "payments") rows = [["recu", "eleve", "matricule", "montant", "mode", "date", "caissier"], ...state.payments.map((row) => [row.id, student(row.studentId).name, student(row.studentId).matricule, row.amount, row.mode, row.date, row.cashier])];
  if (type === "unpaid") rows = [["matricule", "nom", "classe", "parent", "contact", "reste"], ...state.students.filter((row) => balance(row.id) > 0).map((row) => [row.matricule, row.name, row.className, row.parent, row.phone, balance(row.id)])];
  download(`${type}.csv`, rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8");
}

function downloadBackup() {
  if (!requireAction("backup")) return;
  const stamp = new Date().toISOString().slice(0, 10);
  download(`mienra-sauvegarde-${stamp}.json`, JSON.stringify(state, null, 2), "application/json");
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
      state = normalizeState(JSON.parse(reader.result));
      saveState();
      log("Sauvegarde importée");
      renderShell();
    } catch {
      alert("Fichier JSON invalide.");
    }
  };
  reader.readAsText(file);
}

function resetApp() {
  if (!requireAction("backup")) return;
  if (!confirm("Réinitialiser toutes les données de test ?")) return;
  state = seedState();
  saveState();
  renderShell();
}

init();
