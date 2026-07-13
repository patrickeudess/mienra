// MIENRA Web - tableau de bord adapte par role.
// Charge apres app-pro.js : on remplace uniquement le rendu du dashboard.
(function () {
  if (typeof pages === "undefined" || !pages.dashboard) return;

  function secretaryPaymentRows(rows, emptyMessage) {
    return `<table class="cards secretary-payment-table"><thead><tr><th>Élève</th><th>Classe</th><th>Frais</th><th>Payé</th><th>Reste</th><th>Statut</th><th>Action</th></tr></thead><tbody>${rows.map((row) => {
      const left = balance(row.id);
      return `<tr><td>${clean(row.name)}<br><small>${clean(row.matricule)}</small></td><td>${clean(row.className)}</td><td>${money(due(row.id))}</td><td class="amount-ok">${money(paid(row.id))}</td><td class="${left > 0 ? "amount-danger" : "amount-ok"}">${money(left)}</td><td>${financeStatus(row)}</td><td><button class="btn quiet small" onclick="showStudentPayments('${row.id}')">Versements</button>${canAction("payments") ? ` <button class="btn secondary small" onclick="goPay('${row.id}')">Payer</button>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="7">${emptyMessage || "Aucun élève trouvé."}</td></tr>`}</tbody></table>`;
  }

  function secretaryDashboard() {
    const paidRows = state.students.filter((row) => paid(row.id) > 0);
    const noPaymentRows = state.students.filter((row) => due(row.id) > 0 && paid(row.id) <= 0);
    const remainingRows = state.students.filter((row) => balance(row.id) > 0);
    const partialRows = state.students.filter((row) => paid(row.id) > 0 && balance(row.id) > 0);
    const remainingTotal = remainingRows.reduce((sum, row) => sum + balance(row.id), 0);

    $("content").innerHTML = `
      <div class="stats secretary-stats">
        ${stat("Élèves ayant payé", paidRows.length)}
        ${stat("Sans paiement", noPaymentRows.length, noPaymentRows.length ? "danger" : "ok")}
        ${stat("Paiements partiels", partialRows.length)}
        ${stat("Reste à payer", money(remainingTotal), remainingTotal > 0 ? "danger" : "ok")}
      </div>
      <div class="secretary-dashboard">
        <article class="panel"><div class="panel-head"><h2>Élèves qui ont payé</h2><span>${paidRows.length} dossier(s)</span></div>${secretaryPaymentRows(paidRows.sort((a, b) => paid(b.id) - paid(a.id)), "Aucun élève avec paiement.")}</article>
        <article class="panel"><div class="panel-head"><h2>Élèves sans paiement</h2><span>${noPaymentRows.length} dossier(s)</span></div>${secretaryPaymentRows(noPaymentRows.sort((a, b) => String(a.className).localeCompare(String(b.className)) || String(a.name).localeCompare(String(b.name))), "Aucun élève sans paiement.")}</article>
        <article class="panel"><div class="panel-head"><h2>Reste à payer</h2><span>${money(remainingTotal)}</span></div>${selectedPaymentStudent ? studentPaymentsPanel(selectedPaymentStudent) : ""}${secretaryPaymentRows(remainingRows.sort((a, b) => balance(b.id) - balance(a.id)), "Aucun reste à payer.")}</article>
      </div>`;
    decorateCardTables();
  }

  function managementDashboard() {
    const t = totals();
    $("content").innerHTML = `
      ${dashboardDetail ? dashboardDetailPanel(dashboardDetail) : ""}
      <div class="stats">${stat("Élèves", state.students.length)}${stat("Montant attendu", money(t.expected))}${stat("Montant encaissé", money(t.collected), "ok")}${stat("Reste à payer", money(t.remaining), t.remaining > 0 ? "danger" : "ok")}</div>
      <div class="layout-two">
        <article class="panel"><div class="panel-head"><h2>Recouvrement par classe</h2><span>${t.rate}% encaissé</span></div>${collectionChart()}${classSummary()}</article>
        <article class="panel activity-panel"><div class="panel-head"><h2>Effectifs par classe</h2><span>Sexe et statut scolaire</span></div>${classEnrollmentSummary()}</article>
        <article class="panel activity-panel"><div class="panel-head"><h2>Activité récente</h2><span>${state.logs.length} opérations</span></div>${logsTable(9)}</article>
      </div>`;
    attachDashboardStatActions();
    if (dashboardDetail) drawDashboardDetail();
  }

  pages.dashboard = function dashboardByRole() {
    if (session?.role === "Secrétaire") {
      dashboardDetail = null;
      secretaryDashboard();
      return;
    }
    managementDashboard();
  };
})();
