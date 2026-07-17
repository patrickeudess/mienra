// MIENRA Web - tableau de bord adapte par role.
// Charge apres app-pro.js : on remplace uniquement le rendu du dashboard.
(function () {
  if (typeof pages === "undefined" || !pages.dashboard) return;

  const filterState = { q: "", className: "", payStatus: "", studentStatus: "" };

  function syncDashboardFilters(prefix) {
    filterState.q = ($(prefix + "Search")?.value || "").toLowerCase().trim();
    filterState.className = $(prefix + "Class")?.value || "";
    filterState.payStatus = $(prefix + "PayStatus")?.value || "";
    filterState.studentStatus = $(prefix + "StudentStatus")?.value || "";
  }

  function dashboardFilters(prefix, onchange) {
    const classes = state.classes.map((row) => `<option value="${clean(row.name)}" ${filterState.className === row.name ? "selected" : ""}>${clean(row.name)}</option>`).join("");
    const statuses = ["Actif", "Redoublant", "Abandon", "Inactif", "Transféré"].map((status) => `<option value="${clean(status)}" ${filterState.studentStatus === status ? "selected" : ""}>${clean(status)}</option>`).join("");
    return `<div class="filters dashboard-filters">
      <input id="${prefix}Search" value="${clean(filterState.q)}" placeholder="Rechercher nom, matricule, parent, contact..." oninput="${onchange}">
      <select id="${prefix}Class" onchange="${onchange}"><option value="">Toutes les classes</option>${classes}</select>
      <select id="${prefix}PayStatus" onchange="${onchange}"><option value="">Tous paiements</option><option value="paid" ${filterState.payStatus === "paid" ? "selected" : ""}>Soldés</option><option value="partial" ${filterState.payStatus === "partial" ? "selected" : ""}>Partiels</option><option value="unpaid" ${filterState.payStatus === "unpaid" ? "selected" : ""}>Sans paiement</option><option value="remaining" ${filterState.payStatus === "remaining" ? "selected" : ""}>Avec reste</option></select>
      <select id="${prefix}StudentStatus" onchange="${onchange}"><option value="">Tous statuts élève</option>${statuses}</select>
    </div>`;
  }

  function filteredStudents(rows = state.students) {
    return rows.filter((row) => {
      const haystack = [row.name, row.matricule, row.parent, row.phone, row.className, row.status].join(" ").toLowerCase();
      if (filterState.q && !haystack.includes(filterState.q)) return false;
      if (filterState.className && row.className !== filterState.className) return false;
      if (filterState.studentStatus && row.status !== filterState.studentStatus) return false;
      if (filterState.payStatus === "paid" && !(balance(row.id) <= 0 && due(row.id) > 0)) return false;
      if (filterState.payStatus === "partial" && !(paid(row.id) > 0 && balance(row.id) > 0)) return false;
      if (filterState.payStatus === "unpaid" && !(due(row.id) > 0 && paid(row.id) <= 0)) return false;
      if (filterState.payStatus === "remaining" && !(balance(row.id) > 0)) return false;
      return true;
    });
  }

  function secretaryPaymentRows(rows, emptyMessage) {
    return `<table class="cards secretary-payment-table"><thead><tr><th>Élève</th><th>Classe</th><th>Frais</th><th>Payé</th><th>Reste</th><th>Statut</th><th>Action</th></tr></thead><tbody>${rows.map((row) => {
      const left = balance(row.id);
      return `<tr><td>${clean(row.name)}<br><small>${clean(row.matricule)} · ${clean(row.status || "-")}</small></td><td>${clean(row.className)}</td><td>${money(due(row.id))}</td><td class="amount-ok">${money(paid(row.id))}</td><td class="${left > 0 ? "amount-danger" : "amount-ok"}">${money(left)}</td><td>${financeStatus(row)}</td><td><button class="btn quiet small" onclick="showStudentPayments('${row.id}')">Versements</button>${canAction("payments") ? ` <button class="btn secondary small" onclick="goPay('${row.id}')">Payer</button>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="7">${emptyMessage || "Aucun élève trouvé."}</td></tr>`}</tbody></table>`;
  }

  function classRecoveryTable(rows = filteredStudents()) {
    return `<table class="cards dashboard-class-table"><thead><tr><th>Classe</th><th>Élèves</th><th>Attendu</th><th>Payé</th><th>Reste</th><th>Taux</th></tr></thead><tbody>${state.classes.map((row) => {
      const ids = rows.filter((item) => item.className === row.name).map((item) => item.id);
      const expected = ids.reduce((sum, id) => sum + due(id), 0);
      const collected = ids.reduce((sum, id) => sum + paid(id), 0);
      const remaining = expected - collected;
      const rate = expected ? Math.round((collected / expected) * 100) : 0;
      return `<tr><td>${clean(row.name)}<br><small>${clean(row.level)}</small></td><td>${ids.length}</td><td>${money(expected)}</td><td class="amount-ok">${money(collected)}</td><td class="${remaining > 0 ? "amount-danger" : "amount-ok"}">${money(remaining)}</td><td>${rate}%</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function dailyPaymentSummary() {
    const date = today();
    const payments = state.payments.filter((row) => (
      row.year === currentYear()
      && String(row.date || "").slice(0, 10) === date
    ));
    return {
      date,
      receiptCount: payments.length,
      collected: payments.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    };
  }

  function dailySummaryBlock() {
    const summary = dailyPaymentSummary();
    const label = new Date(`${summary.date}T12:00:00`).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    return `<section class="dashboard-daily-summary" aria-labelledby="dailySummaryTitle">
      <div class="daily-summary-head"><h2 id="dailySummaryTitle">Point du jour</h2><span>${clean(label)}</span></div>
      <div class="stats daily-stats">
        ${stat("Reçus générés aujourd'hui", summary.receiptCount, summary.receiptCount ? "ok" : "")}
        ${stat("Montant encaissé aujourd'hui", money(summary.collected), "ok")}
      </div>
    </section>`;
  }

  function secretaryDashboard() {
    const allRows = filteredStudents();
    const paidRows = allRows.filter((row) => paid(row.id) > 0);
    const noPaymentRows = allRows.filter((row) => due(row.id) > 0 && paid(row.id) <= 0);
    const remainingRows = allRows.filter((row) => balance(row.id) > 0);
    const partialRows = allRows.filter((row) => paid(row.id) > 0 && balance(row.id) > 0);
    const remainingTotal = remainingRows.reduce((sum, row) => sum + balance(row.id), 0);

    $("content").innerHTML = `
      ${dailySummaryBlock()}
      <div class="stats secretary-stats">
        ${stat("Élèves trouvés", allRows.length)}
        ${stat("Ayant payé", paidRows.length)}
        ${stat("Sans paiement", noPaymentRows.length, noPaymentRows.length ? "danger" : "ok")}
        ${stat("Reste à payer", money(remainingTotal), remainingTotal > 0 ? "danger" : "ok")}
      </div>
      <article class="panel dashboard-filter-panel"><div class="panel-head"><h2>Filtres</h2><span>Recherche rapide</span></div>${dashboardFilters("secDash", "applySecretaryDashboardFilters()")}</article>
      <div class="secretary-dashboard">
        <article class="panel"><div class="panel-head"><h2>Élèves qui ont payé</h2><span>${paidRows.length} dossier(s)</span></div>${secretaryPaymentRows(paidRows.sort((a, b) => paid(b.id) - paid(a.id)), "Aucun élève avec paiement.")}</article>
        <article class="panel"><div class="panel-head"><h2>Élèves sans paiement</h2><span>${noPaymentRows.length} dossier(s)</span></div>${secretaryPaymentRows(noPaymentRows.sort((a, b) => String(a.className).localeCompare(String(b.className)) || String(a.name).localeCompare(String(b.name))), "Aucun élève sans paiement.")}</article>
        <article class="panel"><div class="panel-head"><h2>Reste à payer</h2><span>${money(remainingTotal)}</span></div>${selectedPaymentStudent ? studentPaymentsPanel(selectedPaymentStudent) : ""}${secretaryPaymentRows(remainingRows.sort((a, b) => balance(b.id) - balance(a.id)), "Aucun reste à payer.")}</article>
      </div>`;
    decorateCardTables();
  }

  function filteredClassEnrollmentSummary(rows = filteredStudents()) {
    const countBy = (items, predicate) => items.filter(predicate).length;
    return `<table class="cards dashboard-class-table"><thead><tr><th>Classe</th><th>Total</th><th>Garçons</th><th>Filles</th><th>Actifs</th><th>Redoublants</th><th>Abandons</th><th>Inactifs</th></tr></thead><tbody>${state.classes.map((row) => {
      const items = rows.filter((item) => item.className === row.name);
      const inactive = countBy(items, (item) => ["Inactif", "Transféré"].includes(item.status));
      return `<tr><td>${clean(row.name)}</td><td>${items.length}</td><td>${countBy(items, (item) => item.gender === "M")}</td><td>${countBy(items, (item) => item.gender === "F")}</td><td>${countBy(items, (item) => item.status === "Actif")}</td><td>${countBy(items, (item) => item.status === "Redoublant")}</td><td>${countBy(items, (item) => item.status === "Abandon")}</td><td>${inactive}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function managementDashboard() {
    const rows = filteredStudents();
    const expected = rows.reduce((sum, row) => sum + due(row.id), 0);
    const collected = rows.reduce((sum, row) => sum + paid(row.id), 0);
    const remaining = expected - collected;
    const rate = expected ? Math.round((collected / expected) * 100) : 0;
    $("content").innerHTML = `
      ${dashboardDetail ? dashboardDetailPanel(dashboardDetail) : ""}
      ${dailySummaryBlock()}
      <div class="stats">${stat("Élèves trouvés", rows.length)}${stat("Montant attendu", money(expected))}${stat("Montant encaissé", money(collected), "ok")}${stat("Reste à payer", money(remaining), remaining > 0 ? "danger" : "ok")}</div>
      <article class="panel dashboard-filter-panel"><div class="panel-head"><h2>Filtres</h2><span>Recherche rapide</span></div>${dashboardFilters("admDash", "applyManagementDashboardFilters()")}</article>
      <div class="dashboard-stack">
        <article class="panel dashboard-recovery"><div class="panel-head"><h2>Recouvrement par classe</h2><span>${rate}% encaissé</span></div>${classRecoveryTable(rows)}</article>
        <article class="panel"><div class="panel-head"><h2>Effectifs par classe</h2><span>Sexe et statut scolaire</span></div>${filteredClassEnrollmentSummary(rows)}</article>
        <article class="panel"><div class="panel-head"><h2>Activité récente</h2><span>${state.logs.length} opérations</span></div>${logsTable(9)}</article>
      </div>`;
    attachDashboardStatActions();
    if (dashboardDetail) drawDashboardDetail();
    decorateCardTables();
  }

  window.applySecretaryDashboardFilters = function () {
    syncDashboardFilters("secDash");
    secretaryDashboard();
  };

  window.applyManagementDashboardFilters = function () {
    syncDashboardFilters("admDash");
    managementDashboard();
  };

  pages.dashboard = function dashboardByRole() {
    if (session?.role === "Secrétaire") {
      dashboardDetail = null;
      secretaryDashboard();
      return;
    }
    managementDashboard();
  };
})();
