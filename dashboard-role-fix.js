// MIENRA Web - tableau de bord adapte par role.
// Charge apres app-pro.js : on remplace uniquement le rendu du dashboard.
(function () {
  if (typeof pages === "undefined" || !pages.dashboard) return;

  function paymentDashboardRows(rows, emptyMessage) {
    return financialRows(rows, emptyMessage || "Aucun élève trouvé.");
  }

  function secretaryDashboard() {
    const paidRows = state.students.filter((row) => paid(row.id) > 0);
    const noPaymentRows = state.students.filter((row) => due(row.id) > 0 && paid(row.id) <= 0);
    const remainingRows = state.students.filter((row) => balance(row.id) > 0);
    const partialRows = state.students.filter((row) => paid(row.id) > 0 && balance(row.id) > 0);
    const remainingTotal = remainingRows.reduce((sum, row) => sum + balance(row.id), 0);

    $("content").innerHTML = `
      <div class="stats">
        ${stat("Élèves ayant payé", paidRows.length)}
        ${stat("Sans paiement", noPaymentRows.length, noPaymentRows.length ? "danger" : "ok")}
        ${stat("Paiements partiels", partialRows.length)}
        ${stat("Reste à payer", money(remainingTotal), remainingTotal > 0 ? "danger" : "ok")}
      </div>
      <div class="layout-two secretary-dashboard">
        <article class="panel"><div class="panel-head"><h2>Élèves qui ont payé</h2><span>${paidRows.length} dossier(s)</span></div>${paymentDashboardRows(paidRows.sort((a, b) => paid(b.id) - paid(a.id)), "Aucun élève avec paiement.")}</article>
        <article class="panel"><div class="panel-head"><h2>Élèves sans paiement</h2><span>${noPaymentRows.length} dossier(s)</span></div>${paymentDashboardRows(noPaymentRows.sort((a, b) => String(a.className).localeCompare(String(b.className)) || String(a.name).localeCompare(String(b.name))), "Aucun élève sans paiement.")}</article>
        <article class="panel activity-panel"><div class="panel-head"><h2>Reste à payer</h2><span>${money(remainingTotal)}</span></div>${paymentDashboardRows(remainingRows.sort((a, b) => balance(b.id) - balance(a.id)), "Aucun reste à payer.")}</article>
      </div>`;
  }

  function managementDashboard() {
    const t = totals();
    $("content").innerHTML = `
      ${dashboardDetail ? dashboardDetailPanel(dashboardDetail) : ""}
      <div class="stats">${stat("Élèves", state.students.length)}${stat("Montant attendu", money(t.expected))}${stat("Montant encaissé", money(t.collected))}${stat("Reste à payer", money(t.remaining), t.remaining > 0 ? "danger" : "ok")}</div>
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
