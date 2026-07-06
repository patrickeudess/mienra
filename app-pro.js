const DB_KEY = 'mienra_web_app_v1';
const $ = (id) => document.getElementById(id);
const money = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
const today = () => new Date().toISOString().slice(0, 10);
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));

let page = 'dashboard';
let session = null;
let editId = null;
let lastReceipt = null;
let state = loadState();

const menu = [
  ['dashboard', 'Tableau de bord'],
  ['students', 'Élèves'],
  ['classes', 'Classes & frais'],
  ['enrollments', 'Inscriptions'],
  ['payments', 'Paiements'],
  ['receipts', 'Reçus'],
  ['unpaid', 'Impayés'],
  ['reports', 'Rapports'],
  ['users', 'Utilisateurs'],
  ['settings', 'Paramètres'],
  ['backup', 'Sauvegardes']
];

function seedState() {
  const classes = [
    ['CP1', 'Primaire', 90000], ['CP2', 'Primaire', 95000], ['CE1', 'Primaire', 100000],
    ['CE2', 'Primaire', 105000], ['CM1', 'Primaire', 120000], ['CM2', 'Primaire', 130000],
    ['6e', 'Collège', 180000], ['5e', 'Collège', 180000], ['4e', 'Collège', 200000], ['3e', 'Collège', 220000]
  ].map(([name, level, fee]) => ({ id: uid('CLS'), name, level, fee }));
  const students = [
    { id: uid('ELV'), matricule: 'GSM-2026-0001', name: 'Aka Mireille', gender: 'F', birth: '2014-04-12', className: '6e', parent: 'Aka Paul', phone: '0700000001', address: 'Yopougon', status: 'Actif' },
    { id: uid('ELV'), matricule: 'GSM-2026-0002', name: 'Kouadio Jean', gender: 'M', birth: '2015-09-20', className: 'CM2', parent: 'Kouadio Anne', phone: '0700000002', address: 'Cocody', status: 'Actif' },
    { id: uid('ELV'), matricule: 'GSM-2026-0003', name: 'Traoré Aminata', gender: 'F', birth: '2012-01-11', className: '4e', parent: 'Traoré Moussa', phone: '0700000003', address: 'Abobo', status: 'Actif' }
  ];
  const enrollments = students.map(s => ({ id: uid('INS'), studentId: s.id, year: '2026-2027', className: s.className, amount: classFee(classes, s.className), discount: 0, date: today(), note: 'Inscription annuelle' }));
  return {
    school: { name: 'Groupe Scolaire MIENRA', code: 'GSM', year: '2026-2027', receiptPrefix: 'REC', matriculeYear: '2026', phone: '+225 07 00 00 00 00', email: 'contact@mienra.ci', address: 'Abidjan, Côte d’Ivoire', director: 'Directeur de l’école', logo: 'M', receiptFooter: 'Merci pour votre paiement.' },
    years: ['2025-2026', '2026-2027'],
    users: [
      { id: uid('USR'), name: 'Administrateur', login: 'admin', password: 'admin123', role: 'Administrateur', active: true },
      { id: uid('USR'), name: 'Directeur', login: 'directeur', password: 'directeur123', role: 'Directeur', active: true },
      { id: uid('USR'), name: 'Secrétaire', login: 'secretaire', password: 'secretaire123', role: 'Secrétaire', active: true }
    ],
    classes, students, enrollments,
    payments: [
      { id: 'REC-2026-0001', studentId: students[0].id, amount: 180000, mode: 'Espèces', date: today(), cashier: 'Secrétaire', note: 'Paiement complet' },
      { id: 'REC-2026-0002', studentId: students[1].id, amount: 100000, mode: 'Mobile Money', date: today(), cashier: 'Secrétaire', note: 'Premier versement' }
    ],
    logs: [],
    backups: []
  };
}

function classFee(classes, name) { return Number(classes.find(c => c.name === name)?.fee || 0); }
function loadState() { try { return JSON.parse(localStorage.getItem(DB_KEY)) || seedState(); } catch { return seedState(); } }
function saveState() { localStorage.setItem(DB_KEY, JSON.stringify(state)); }
function log(action) { state.logs.unshift({ date: new Date().toLocaleString('fr-FR'), user: session?.name || 'Système', action }); state.logs = state.logs.slice(0, 200); saveState(); }
function student(id) { return state.students.find(s => s.id === id) || {}; }
function totalDue(id) { return state.enrollments.filter(e => e.studentId === id).reduce((s, e) => s + Number(e.amount || 0) - Number(e.discount || 0), 0); }
function totalPaid(id) { return state.payments.filter(p => p.studentId === id).reduce((s, p) => s + Number(p.amount || 0), 0); }
function balance(id) { return totalDue(id) - totalPaid(id); }
function rate(id) { const d = totalDue(id); return d ? Math.min(100, Math.round((totalPaid(id) / d) * 100)) : 0; }
function canManage() { return ['Administrateur', 'Directeur', 'Secrétaire'].includes(session?.role); }

function init() { showLogin(); }
function showLogin() {
  document.getElementById('root').innerHTML = `
    <div class="login"><div class="login-card">
      <h1>MIENRA Web</h1>
      <p>Application web de gestion scolaire : inscriptions, paiements, reçus, impayés et rapports.</p>
      <label>Identifiant</label><input id="login" value="admin">
      <br><br><label>Mot de passe</label><input id="password" type="password" value="admin123">
      <div class="btns"><button class="btn primary" onclick="login()">Se connecter</button><button class="btn light" onclick="enterAsAdmin()">Accès test rapide</button></div>
      <div class="notice" style="margin-top:14px">Comptes : admin/admin123 · directeur/directeur123 · secretaire/secretaire123</div>
    </div></div>`;
}
function login() {
  const u = state.users.find(u => u.login === $('login').value.trim() && u.password === $('password').value.trim() && u.active);
  if (!u) return alert('Identifiants incorrects ou utilisateur inactif.');
  session = u; log('Connexion'); drawApp();
}
function enterAsAdmin() { session = state.users[0]; drawApp(); }
function logout() { session = null; showLogin(); }
function drawApp() {
  document.getElementById('root').innerHTML = `
    <div class="app">
      <aside class="side"><div class="brand">MIENRA</div><div class="tag">Application web GitHub Pages</div>
      <div class="user"><b>${escapeHtml(state.school.name)}</b><br><span class="small" style="color:#dbeafe">${escapeHtml(session.name)} · ${escapeHtml(session.role)}</span><br><button class="btn light" style="margin-top:10px" onclick="logout()">Déconnexion</button></div>
      <div class="nav" id="nav"></div></aside>
      <main class="main"><div class="top"><h1 id="title"></h1><div class="pill">Version web testable par lien GitHub Pages</div></div><div id="view"></div></main>
    </div>`;
  renderNav(); render();
}
function renderNav() { $('nav').innerHTML = menu.map(([k, t]) => `<button class="${page === k ? 'active' : ''}" onclick="go('${k}')">${t}</button>`).join(''); }
function go(k) { page = k; editId = null; renderNav(); render(); }
function render() { $('title').textContent = menu.find(m => m[0] === page)[1]; pages[page](); }

const pages = {
  dashboard() {
    const expected = state.students.reduce((s, st) => s + totalDue(st.id), 0);
    const paid = state.students.reduce((s, st) => s + totalPaid(st.id), 0);
    const unpaid = expected - paid;
    const rateGlobal = expected ? Math.round((paid / expected) * 100) : 0;
    $('view').innerHTML = `
      <div class="grid"><div class="stat"><b>${state.students.length}</b><span>Élèves</span></div><div class="stat"><b>${money(expected)}</b><span>Attendu</span></div><div class="stat"><b>${money(paid)}</b><span>Encaissé</span></div><div class="stat"><b>${rateGlobal}%</b><span>Taux paiement</span></div></div>
      <div class="two"><div class="card"><h2>Situation par classe</h2>${classSummary()}</div><div class="card"><h2>Dernières activités</h2>${logs(8)}</div></div>`;
  },
  students() {
    const s = editId ? state.students.find(x => x.id === editId) : {};
    $('view').innerHTML = `
      <div class="card"><h2>${editId ? 'Modifier' : 'Ajouter'} un élève</h2>${studentForm(s)}<div class="btns"><button class="btn primary" onclick="saveStudent()">Enregistrer</button>${editId ? '<button class="btn light" onclick="editId=null;pages.students()">Annuler</button>' : ''}</div></div>
      <div class="card"><h2>Liste des élèves</h2><div class="form-grid"><input id="qStudent" placeholder="Recherche nom, matricule, parent, contact" oninput="drawStudentsTable()"><select id="filterClass" onchange="drawStudentsTable()"><option value="">Toutes les classes</option>${state.classes.map(c => `<option>${c.name}</option>`).join('')}</select><select id="filterPay" onchange="drawStudentsTable()"><option value="">Tous paiements</option><option value="soldé">Soldés</option><option value="partiel">Partiels</option><option value="impayé">Impayés</option></select></div><div id="studentsTable"></div></div>`;
    drawStudentsTable();
  },
  classes() {
    const c = editId ? state.classes.find(x => x.id === editId) : {};
    $('view').innerHTML = `
      <div class="card"><h2>${editId ? 'Modifier' : 'Ajouter'} une classe</h2><div class="form-grid"><div><label>Classe</label><input id="className" value="${escapeHtml(c?.name || '')}"></div><div><label>Niveau</label><select id="level"><option ${c?.level === 'Primaire' ? 'selected' : ''}>Primaire</option><option ${c?.level === 'Collège' ? 'selected' : ''}>Collège</option><option ${c?.level === 'Lycée' ? 'selected' : ''}>Lycée</option></select></div><div><label>Frais annuels</label><input id="fee" type="number" value="${c?.fee || 100000}"></div></div><div class="btns"><button class="btn primary" onclick="saveClass()">Enregistrer</button></div></div>
      <div class="card"><h2>Classes et frais scolaires</h2><table><tr><th>Classe</th><th>Niveau</th><th>Frais</th><th>Élèves</th><th>Actions</th></tr>${state.classes.map(c => `<tr><td>${c.name}</td><td>${c.level}</td><td>${money(c.fee)}</td><td>${state.students.filter(s => s.className === c.name).length}</td><td><button class="btn light" onclick="editClass('${c.id}')">Modifier</button> <button class="btn danger" onclick="deleteClass('${c.id}')">Supprimer</button></td></tr>`).join('')}</table></div>`;
  },
  enrollments() {
    $('view').innerHTML = `
      <div class="card"><h2>Nouvelle inscription</h2><div class="form-grid"><div><label>Élève</label><select id="enStudent" onchange="syncEnrollmentFee()">${state.students.map(s => `<option value="${s.id}">${s.name} - ${s.matricule}</option>`).join('')}</select></div><div><label>Classe</label><select id="enClass" onchange="syncEnrollmentFee()">${state.classes.map(c => `<option>${c.name}</option>`).join('')}</select></div><div><label>Année</label><select id="enYear">${state.years.map(y => `<option ${y === state.school.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div><div><label>Montant</label><input id="enAmount" type="number"></div><div><label>Remise</label><input id="enDiscount" type="number" value="0"></div><div><label>Date</label><input id="enDate" type="date" value="${today()}"></div></div><div><label>Note</label><input id="enNote" value="Inscription annuelle"></div><div class="btns"><button class="btn primary" onclick="saveEnrollment()">Valider l'inscription</button></div></div>
      <div class="card"><h2>Historique des inscriptions</h2>${enrollmentsTable()}</div>`;
    syncEnrollmentFee();
  },
  payments() {
    $('view').innerHTML = `
      <div class="card"><h2>Nouveau paiement</h2><div class="form-grid"><div><label>Élève</label><select id="payStudent" onchange="payInfo()">${state.students.map(s => `<option value="${s.id}">${s.name} - reste ${money(balance(s.id))}</option>`).join('')}</select></div><div><label>Montant payé</label><input id="payAmount" type="number" value="50000"></div><div><label>Mode</label><select id="payMode"><option>Espèces</option><option>Mobile Money</option><option>Chèque</option><option>Virement</option><option>Carte bancaire</option></select></div><div><label>Date</label><input id="payDate" type="date" value="${today()}"></div><div><label>Caissier</label><input id="cashier" value="${escapeHtml(session.name)}"></div><div><label>Note</label><input id="payNote" value="Versement frais scolaires"></div></div><div class="notice" id="payInfo"></div><div class="btns"><button class="btn primary" onclick="savePayment()">Enregistrer et générer reçu</button></div></div>
      <div class="card"><h2>Historique des paiements</h2>${paymentsTable()}</div>`;
    payInfo();
  },
  receipts() { receiptView(); },
  unpaid() {
    const rows = state.students.filter(s => balance(s.id) > 0).sort((a, b) => balance(b.id) - balance(a.id));
    $('view').innerHTML = `<div class="card"><h2>Liste des impayés</h2><div class="notice">Total à recouvrer : <b>${money(rows.reduce((a, s) => a + balance(s.id), 0))}</b></div><table><tr><th>Élève</th><th>Classe</th><th>Attendu</th><th>Payé</th><th>Reste</th><th>Parent</th><th>Action</th></tr>${rows.map(s => `<tr><td>${s.name}<br><span class="small">${s.matricule}</span></td><td>${s.className}</td><td>${money(totalDue(s.id))}</td><td>${money(totalPaid(s.id))}</td><td class="bad">${money(balance(s.id))}</td><td>${s.parent}<br>${s.phone}</td><td><button class="btn secondary" onclick="goPay('${s.id}')">Payer</button></td></tr>`).join('') || '<tr><td colspan="7">Aucun impayé</td></tr>'}</table></div>`;
  },
  reports() {
    const expected = state.students.reduce((s, st) => s + totalDue(st.id), 0);
    const paid = state.students.reduce((s, st) => s + totalPaid(st.id), 0);
    $('view').innerHTML = `<div class="card"><h2>Rapports financiers</h2><div class="grid"><div class="stat"><b>${money(expected)}</b><span>Total attendu</span></div><div class="stat"><b>${money(paid)}</b><span>Total encaissé</span></div><div class="stat"><b>${money(expected-paid)}</b><span>Impayés</span></div><div class="stat"><b>${expected ? Math.round(paid/expected*100) : 0}%</b><span>Taux</span></div></div><div class="btns"><button class="btn secondary" onclick="exportCSV('students')">Exporter élèves CSV</button><button class="btn secondary" onclick="exportCSV('payments')">Exporter paiements CSV</button><button class="btn secondary" onclick="exportCSV('unpaid')">Exporter impayés CSV</button><button class="btn light" onclick="window.print()">Imprimer</button></div></div><div class="card"><h2>Rapport par classe</h2>${classSummary()}</div>`;
  },
  users() {
    const u = editId ? state.users.find(x => x.id === editId) : {};
    $('view').innerHTML = `<div class="card"><h2>${editId ? 'Modifier' : 'Ajouter'} utilisateur</h2><div class="form-grid"><div><label>Nom</label><input id="userName" value="${escapeHtml(u?.name || '')}"></div><div><label>Login</label><input id="userLogin" value="${escapeHtml(u?.login || '')}"></div><div><label>Mot de passe</label><input id="userPass" value="${escapeHtml(u?.password || '123456')}"></div><div><label>Rôle</label><select id="userRole"><option ${u?.role === 'Administrateur' ? 'selected' : ''}>Administrateur</option><option ${u?.role === 'Directeur' ? 'selected' : ''}>Directeur</option><option ${u?.role === 'Secrétaire' ? 'selected' : ''}>Secrétaire</option><option ${u?.role === 'Consultation' ? 'selected' : ''}>Consultation</option></select></div><div><label>Statut</label><select id="userActive"><option value="true" ${u?.active !== false ? 'selected' : ''}>Actif</option><option value="false" ${u?.active === false ? 'selected' : ''}>Inactif</option></select></div></div><div class="btns"><button class="btn primary" onclick="saveUser()">Enregistrer</button></div></div><div class="card"><h2>Utilisateurs</h2><table><tr><th>Nom</th><th>Login</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr>${state.users.map(u => `<tr><td>${u.name}</td><td>${u.login}</td><td>${u.role}</td><td>${u.active?'Actif':'Inactif'}</td><td><button class="btn light" onclick="editUser('${u.id}')">Modifier</button> <button class="btn danger" onclick="deleteUser('${u.id}')">Supprimer</button></td></tr>`).join('')}</table></div>`;
  },
  settings() {
    const s = state.school;
    $('view').innerHTML = `<div class="card"><h2>Paramètres de l'établissement</h2><div class="form-grid"><div><label>Nom école</label><input id="schoolName" value="${escapeHtml(s.name)}"></div><div><label>Code</label><input id="schoolCode" value="${escapeHtml(s.code)}"></div><div><label>Année active</label><input id="schoolYear" value="${escapeHtml(s.year)}"></div><div><label>Téléphone</label><input id="schoolPhone" value="${escapeHtml(s.phone)}"></div><div><label>Email</label><input id="schoolEmail" value="${escapeHtml(s.email)}"></div><div><label>Adresse</label><input id="schoolAddress" value="${escapeHtml(s.address)}"></div><div><label>Directeur</label><input id="director" value="${escapeHtml(s.director)}"></div><div><label>Préfixe reçu</label><input id="receiptPrefix" value="${escapeHtml(s.receiptPrefix)}"></div><div><label>Année matricule</label><input id="matriculeYear" value="${escapeHtml(s.matriculeYear)}"></div><div><label>Logo texte</label><input id="logo" value="${escapeHtml(s.logo)}"></div></div><label>Message reçu</label><textarea id="receiptFooter">${escapeHtml(s.receiptFooter)}</textarea><div class="btns"><button class="btn primary" onclick="saveSettings()">Enregistrer paramètres</button></div></div>`;
  },
  backup() {
    $('view').innerHTML = `<div class="card"><h2>Sauvegardes</h2><p>Cette version GitHub Pages conserve les données dans le navigateur. Exportez un fichier JSON pour transférer les données.</p><div class="btns"><button class="btn secondary" onclick="downloadBackup()">Exporter sauvegarde JSON</button><button class="btn warn" onclick="resetApp()">Réinitialiser application</button></div><br><label>Importer une sauvegarde JSON</label><input type="file" accept=".json" onchange="importBackup(this)"></div><div class="card"><h2>Journal</h2>${logs(40)}</div>`;
  }
};

function studentForm(s) {
  return `<div class="form-grid"><div><label>Nom complet</label><input id="stName" value="${escapeHtml(s?.name || '')}"></div><div><label>Genre</label><select id="stGender"><option ${s?.gender === 'M' ? 'selected' : ''}>M</option><option ${s?.gender === 'F' ? 'selected' : ''}>F</option></select></div><div><label>Date naissance</label><input id="stBirth" type="date" value="${escapeHtml(s?.birth || '')}"></div><div><label>Classe</label><select id="stClass">${state.classes.map(c => `<option ${s?.className === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div><div><label>Parent/Tuteur</label><input id="stParent" value="${escapeHtml(s?.parent || '')}"></div><div><label>Contact</label><input id="stPhone" value="${escapeHtml(s?.phone || '')}"></div><div><label>Adresse</label><input id="stAddress" value="${escapeHtml(s?.address || '')}"></div><div><label>Statut</label><select id="stStatus"><option ${s?.status === 'Actif' ? 'selected' : ''}>Actif</option><option ${s?.status === 'Inactif' ? 'selected' : ''}>Inactif</option><option ${s?.status === 'Transféré' ? 'selected' : ''}>Transféré</option></select></div></div>`;
}
function drawStudentsTable() {
  const q = ($('qStudent')?.value || '').toLowerCase();
  const fc = $('filterClass')?.value || '';
  const fp = $('filterPay')?.value || '';
  let rows = state.students.filter(s => [s.name, s.matricule, s.parent, s.phone, s.className].join(' ').toLowerCase().includes(q));
  if (fc) rows = rows.filter(s => s.className === fc);
  if (fp === 'soldé') rows = rows.filter(s => balance(s.id) <= 0 && totalDue(s.id) > 0);
  if (fp === 'partiel') rows = rows.filter(s => balance(s.id) > 0 && totalPaid(s.id) > 0);
  if (fp === 'impayé') rows = rows.filter(s => balance(s.id) > 0 && totalPaid(s.id) === 0);
  $('studentsTable').innerHTML = `<table><tr><th>Matricule</th><th>Élève</th><th>Classe</th><th>Parent</th><th>Paiement</th><th>Actions</th></tr>${rows.map(s => `<tr><td>${s.matricule}</td><td>${s.name}<br><span class="small">${s.gender} · ${s.status}</span></td><td>${s.className}</td><td>${s.parent}<br>${s.phone}</td><td>${paymentStatus(s)}</td><td><button class="btn light" onclick="editStudent('${s.id}')">Modifier</button> <button class="btn secondary" onclick="quickEnroll('${s.id}')">Inscrire</button> <button class="btn danger" onclick="deleteStudent('${s.id}')">Supprimer</button></td></tr>`).join('') || '<tr><td colspan="6">Aucun élève trouvé</td></tr>'}</table>`;
}
function paymentStatus(s) { const r = rate(s.id); const b = balance(s.id); return `<b class="${b<=0?'ok':totalPaid(s.id)>0?'mid':'bad'}">${b<=0?'Soldé':totalPaid(s.id)>0?'Partiel':'Impayé'}</b><div class="progress"><div class="bar" style="width:${r}%"></div></div><span class="small">${r}% · reste ${money(b)}</span>`; }
function saveStudent() {
  const name = $('stName').value.trim(); if (!name) return alert('Nom obligatoire');
  const data = { name, gender: $('stGender').value, birth: $('stBirth').value, className: $('stClass').value, parent: $('stParent').value, phone: $('stPhone').value, address: $('stAddress').value, status: $('stStatus').value };
  if (editId) { Object.assign(state.students.find(s => s.id === editId), data); log(`Élève modifié : ${name}`); }
  else { const n = String(state.students.length + 1).padStart(4, '0'); state.students.push({ id: uid('ELV'), matricule: `${state.school.code}-${state.school.matriculeYear}-${n}`, ...data }); log(`Élève ajouté : ${name}`); }
  editId = null; saveState(); pages.students();
}
function editStudent(id) { editId = id; pages.students(); }
function deleteStudent(id) { if (!confirm('Supprimer cet élève et ses données liées ?')) return; state.students = state.students.filter(s => s.id !== id); state.enrollments = state.enrollments.filter(e => e.studentId !== id); state.payments = state.payments.filter(p => p.studentId !== id); log('Élève supprimé'); saveState(); pages.students(); }
function quickEnroll(id) { page = 'enrollments'; renderNav(); pages.enrollments(id); }

function saveClass() { const name = $('className').value.trim(); if (!name) return alert('Classe obligatoire'); const data = { name, level: $('level').value, fee: Number($('fee').value) }; if (editId) { Object.assign(state.classes.find(c => c.id === editId), data); log(`Classe modifiée : ${name}`); } else { state.classes.push({ id: uid('CLS'), ...data }); log(`Classe ajoutée : ${name}`); } editId = null; saveState(); pages.classes(); }
function editClass(id) { editId = id; pages.classes(); }
function deleteClass(id) { if (!confirm('Supprimer cette classe ?')) return; state.classes = state.classes.filter(c => c.id !== id); saveState(); pages.classes(); }
function syncEnrollmentFee() { const fee = classFee(state.classes, $('enClass')?.value); if ($('enAmount')) $('enAmount').value = fee; }
function saveEnrollment() { const e = { id: uid('INS'), studentId: $('enStudent').value, className: $('enClass').value, year: $('enYear').value, amount: Number($('enAmount').value), discount: Number($('enDiscount').value || 0), date: $('enDate').value, note: $('enNote').value }; state.enrollments.push(e); const st = student(e.studentId); st.className = e.className; log(`Inscription validée : ${st.name}`); saveState(); pages.enrollments(); }
function enrollmentsTable() { return `<table><tr><th>Élève</th><th>Classe</th><th>Année</th><th>Montant</th><th>Remise</th><th>Net</th><th>Date</th><th>Action</th></tr>${state.enrollments.map(e => `<tr><td>${student(e.studentId).name}<br><span class="small">${student(e.studentId).matricule}</span></td><td>${e.className}</td><td>${e.year}</td><td>${money(e.amount)}</td><td>${money(e.discount)}</td><td>${money(e.amount-e.discount)}</td><td>${e.date}</td><td><button class="btn danger" onclick="deleteEnrollment('${e.id}')">Supprimer</button></td></tr>`).join('')}</table>`; }
function deleteEnrollment(id) { if (!confirm('Supprimer cette inscription ?')) return; state.enrollments = state.enrollments.filter(e => e.id !== id); log('Inscription supprimée'); saveState(); pages.enrollments(); }

function payInfo() { const id = $('payStudent')?.value; if ($('payInfo')) $('payInfo').innerHTML = `Attendu : <b>${money(totalDue(id))}</b> · Payé : <b>${money(totalPaid(id))}</b> · Reste : <b>${money(balance(id))}</b>`; }
function savePayment() { const sid = $('payStudent').value, amount = Number($('payAmount').value); if (amount <= 0) return alert('Montant invalide'); const p = { id: `${state.school.receiptPrefix}-${new Date().getFullYear()}-${String(state.payments.length + 1).padStart(4, '0')}`, studentId: sid, amount, mode: $('payMode').value, date: $('payDate').value, cashier: $('cashier').value, note: $('payNote').value }; state.payments.unshift(p); lastReceipt = p.id; log(`Paiement enregistré : ${student(sid).name} - ${money(amount)}`); saveState(); page = 'receipts'; renderNav(); receiptView(); }
function paymentsTable() { return `<table><tr><th>Reçu</th><th>Élève</th><th>Montant</th><th>Mode</th><th>Date</th><th>Caissier</th><th>Actions</th></tr>${state.payments.map(p => `<tr><td>${p.id}</td><td>${student(p.studentId).name}<br><span class="small">${student(p.studentId).matricule}</span></td><td>${money(p.amount)}</td><td>${p.mode}</td><td>${p.date}<br><span class="small">${p.note}</span></td><td>${p.cashier}</td><td><button class="btn light" onclick="openReceipt('${p.id}')">Reçu</button> <button class="btn danger" onclick="deletePayment('${p.id}')">Supprimer</button></td></tr>`).join('')}</table>`; }
function deletePayment(id) { if (!confirm('Supprimer ce paiement ?')) return; state.payments = state.payments.filter(p => p.id !== id); log('Paiement supprimé'); saveState(); pages.payments(); }
function openReceipt(id) { lastReceipt = id; page = 'receipts'; renderNav(); receiptView(); }
function receiptView() { const p = state.payments.find(x => x.id === lastReceipt) || state.payments[0]; if (!p) { $('view').innerHTML = '<div class="card empty">Aucun reçu disponible.</div>'; return; } const s = student(p.studentId); $('view').innerHTML = `<div class="card"><h2>Reçu de paiement</h2><div class="receipt"><div class="logo-box">${escapeHtml(state.school.logo)}</div><h2>${escapeHtml(state.school.name)}</h2><p style="text-align:center">${escapeHtml(state.school.address)} | ${escapeHtml(state.school.phone)} | ${escapeHtml(state.school.email)}</p><hr><div class="two"><div><p><b>N° reçu :</b> ${p.id}</p><p><b>Date :</b> ${p.date}</p><p><b>Élève :</b> ${s.name}</p><p><b>Matricule :</b> ${s.matricule}</p><p><b>Classe :</b> ${s.className}</p></div><div><p><b>Montant payé :</b> ${money(p.amount)}</p><p><b>Mode :</b> ${p.mode}</p><p><b>Total attendu :</b> ${money(totalDue(s.id))}</p><p><b>Total payé :</b> ${money(totalPaid(s.id))}</p><p><b>Reste :</b> ${money(balance(s.id))}</p></div></div><p><b>Observation :</b> ${escapeHtml(p.note || '-')}</p><br><div class="two"><p>Caissier : ${escapeHtml(p.cashier)}<br><br>Signature : ____________________</p><p>Direction : ${escapeHtml(state.school.director)}<br><br>Cachet : ____________________</p></div><p style="text-align:center" class="small">${escapeHtml(state.school.receiptFooter)}</p></div><div class="btns"><button class="btn secondary" onclick="window.print()">Imprimer / Enregistrer PDF</button><button class="btn light" onclick="go('payments')">Retour paiements</button></div></div>`; }
function goPay(id) { page = 'payments'; renderNav(); pages.payments(); $('payStudent').value = id; payInfo(); }

function classSummary() { return `<table><tr><th>Classe</th><th>Niveau</th><th>Élèves</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr>${state.classes.map(c => { const ids = state.students.filter(s => s.className === c.name).map(s => s.id); const d = ids.reduce((a, id) => a + totalDue(id), 0); const p = ids.reduce((a, id) => a + totalPaid(id), 0); return `<tr><td>${c.name}</td><td>${c.level}</td><td>${ids.length}</td><td>${money(d)}</td><td>${money(p)}</td><td class="${d-p>0?'bad':'ok'}">${money(d-p)}</td></tr>`; }).join('')}</table>`; }
function logs(n) { return `<table><tr><th>Date</th><th>Utilisateur</th><th>Action</th></tr>${state.logs.slice(0, n).map(l => `<tr><td>${l.date}</td><td>${escapeHtml(l.user)}</td><td>${escapeHtml(l.action)}</td></tr>`).join('') || '<tr><td colspan="3">Aucune activité</td></tr>'}</table>`; }
function saveUser() { const data = { name: $('userName').value, login: $('userLogin').value, password: $('userPass').value, role: $('userRole').value, active: $('userActive').value === 'true' }; if (editId) Object.assign(state.users.find(u => u.id === editId), data); else state.users.push({ id: uid('USR'), ...data }); log(`Utilisateur enregistré : ${data.login}`); editId = null; saveState(); pages.users(); }
function editUser(id) { editId = id; pages.users(); }
function deleteUser(id) { if (!confirm('Supprimer cet utilisateur ?')) return; state.users = state.users.filter(u => u.id !== id); saveState(); pages.users(); }
function saveSettings() { Object.assign(state.school, { name: $('schoolName').value, code: $('schoolCode').value, year: $('schoolYear').value, phone: $('schoolPhone').value, email: $('schoolEmail').value, address: $('schoolAddress').value, director: $('director').value, receiptPrefix: $('receiptPrefix').value, matriculeYear: $('matriculeYear').value, logo: $('logo').value, receiptFooter: $('receiptFooter').value }); if (!state.years.includes(state.school.year)) state.years.push(state.school.year); log('Paramètres enregistrés'); saveState(); drawApp(); }

function exportCSV(type) { let rows = []; if (type === 'students') rows = [['matricule','nom','classe','parent','contact','attendu','paye','reste'], ...state.students.map(s => [s.matricule, s.name, s.className, s.parent, s.phone, totalDue(s.id), totalPaid(s.id), balance(s.id)])]; if (type === 'payments') rows = [['recu','eleve','matricule','montant','mode','date','caissier'], ...state.payments.map(p => [p.id, student(p.studentId).name, student(p.studentId).matricule, p.amount, p.mode, p.date, p.cashier])]; if (type === 'unpaid') rows = [['matricule','nom','classe','parent','contact','reste'], ...state.students.filter(s => balance(s.id) > 0).map(s => [s.matricule, s.name, s.className, s.parent, s.phone, balance(s.id)])]; download(`${type}.csv`, rows.map(r => r.map(x => `"${String(x ?? '').replaceAll('"','""')}"`).join(';')).join('\n'), 'text/csv'); }
function downloadBackup() { download('mienra-web-sauvegarde.json', JSON.stringify(state, null, 2), 'application/json'); }
function download(name, content, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); }
function importBackup(input) { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { state = JSON.parse(reader.result); saveState(); log('Sauvegarde importée'); drawApp(); } catch { alert('Fichier invalide'); } }; reader.readAsText(file); }
function resetApp() { if (!confirm('Réinitialiser toutes les données ?')) return; state = seedState(); saveState(); drawApp(); }

init();
