// MIENRA Web - Mode production et état du système
// Charge après les modules de synchronisation. Ajoute une page de contrôle et
// bloque les opérations dangereuses une fois l'application prête pour l'école.

(() => {
  if (typeof pages !== "object" || typeof state !== "object") return;

  const originalRenderShell = typeof renderShell === "function" ? renderShell : null;
  const originalRemoveDemoData = typeof removeDemoData === "function" ? removeDemoData : null;
  const originalResetApp = typeof resetApp === "function" ? resetApp : null;
  const originalImportBackup = typeof importBackup === "function" ? importBackup : null;
  const originalRestoreLocalBackup = typeof restoreLocalBackup === "function" ? restoreLocalBackup : null;

  function productionEnabled() {
    return !!state.productionMode;
  }

  function statusBadge(ok, labelOk = "OK", labelKo = "À vérifier") {
    return `<span class="system-badge ${ok ? "ok" : "warn"}">${ok ? labelOk : labelKo}</span>`;
  }

  function maxReceiptNumber() {
    return state.payments.reduce((max, row) => {
      const n = parseInt(String(row.receiptNo || row.id || "").split("-").pop(), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
  }

  function lastReceiptNo() {
    return state.payments[0]?.receiptNo || state.payments[0]?.id || "-";
  }

  function systemRows() {
    const backup = typeof lastBackupInfo === "function" ? lastBackupInfo() : { iso: null, days: null };
    return [
      ["Mode production", productionEnabled() ? "Activé" : "Désactivé", statusBadge(productionEnabled(), "Protégé", "Ouvert")],
      ["Mode données", typeof syncLabel === "function" ? syncLabel() : "-", statusBadge(!cloudLastError, "Stable", "Erreur")],
      ["Supabase configuré", cloudEnabled() ? "Oui" : "Non", statusBadge(cloudEnabled())],
      ["Session authentifiée", authSession ? "Oui" : "Non", statusBadge(!!authSession, "Connecté", "Non connecté")],
      ["Année scolaire", currentYear(), statusBadge(!!currentYear())],
      ["Élèves", state.students.length, statusBadge(true)],
      ["Paiements", state.payments.length, statusBadge(true)],
      ["Inscriptions", state.enrollments.length, statusBadge(true)],
      ["Dernier reçu", lastReceiptNo(), statusBadge(state.payments.length === 0 || !!lastReceiptNo())],
      ["Compteur reçu local", maxReceiptNumber(), statusBadge(true)],
      ["Dernière sauvegarde", backup.iso ? `${new Date(backup.iso).toLocaleDateString("fr-FR")} (${backup.days} j)` : "Aucune sur cet appareil", statusBadge(backup.iso && backup.days < BACKUP_REMIND_DAYS, "Récente", "À faire")],
      ["Dernière mise à jour", state.updatedAt ? new Date(state.updatedAt).toLocaleString("fr-FR") : "-", statusBadge(!!state.updatedAt)]
    ];
  }

  function systemTable() {
    return `<table class="cards"><thead><tr><th>Contrôle</th><th>Valeur</th><th>État</th></tr></thead><tbody>${systemRows().map(([name, value, badge]) => `<tr><td>${clean(name)}</td><td>${clean(value)}</td><td>${badge}</td></tr>`).join("")}</tbody></table>`;
  }

  async function drawRelationalProbe() {
    const target = document.getElementById("systemRelationalProbe");
    if (!target) return;
    let content = "Non vérifié";
    let ok = false;
    try {
      if (window.mienraRelationnel?.etat) {
        const result = await window.mienraRelationnel.etat();
        ok = !!result.pret;
        content = `${result.actif ? "Actif" : "Disponible"} ${result.erreur ? `- ${result.erreur}` : ""}`;
      } else {
        content = "Adaptateur non chargé";
      }
    } catch (error) {
      content = error?.message || "Erreur de vérification";
    }
    target.innerHTML = `<div class="system-probe"><b>Tables relationnelles</b><span>${clean(content)}</span>${statusBadge(ok)}</div>`;
  }

  function productionActions() {
    const canToggle = session?.role === "Administrateur";
    return `<div class="system-actions actions">
      ${canToggle ? `<button class="btn ${productionEnabled() ? "danger" : "secondary"}" onclick="toggleProductionMode()">${productionEnabled() ? "Désactiver le mode production" : "Activer le mode production"}</button>` : ""}
      <button class="btn quiet" onclick="syncNow()">Synchroniser</button>
      ${canAction("backup") ? `<button class="btn quiet" onclick="downloadBackup()">Exporter une sauvegarde</button>` : ""}
      ${!productionEnabled() && canAction("backup") ? `<button class="btn danger" onclick="cleanTestDataFromSystem()">Nettoyer données test</button>` : ""}
    </div>`;
  }

  pages.system = function systemPage() {
    const t = totals();
    $("content").innerHTML = `
      <article class="panel system-panel">
        <div class="panel-head"><h2>État du système</h2><span>Contrôles avant utilisation réelle</span></div>
        <div class="stats">${stat("Élèves", state.students.length)}${stat("Paiements", state.payments.length)}${stat("Encaissé", money(t.collected), "ok")}${stat("Reste", money(t.remaining), t.remaining > 0 ? "danger" : "ok")}</div>
        <div id="systemRelationalProbe" class="system-probe-wrap"></div>
        ${systemTable()}
        ${productionActions()}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Actions protégées</h2><span>Bloquées quand le mode production est activé</span></div>
        <div class="system-lock-list">
          <span>Réinitialisation</span>
          <span>Import JSON</span>
          <span>Restauration locale</span>
          <span>Suppression données démo/test</span>
        </div>
      </article>`;
    decorateCardTables?.();
    drawRelationalProbe();
  };

  function ensureSystemMenu() {
    if (!menu.some(([key]) => key === "system")) menu.push(["system", "État système", "🩺"]);
    ["Administrateur", "Directeur"].forEach((role) => {
      if (roleAccess[role] && !roleAccess[role].pages.includes("system")) roleAccess[role].pages.push("system");
    });
  }

  window.toggleProductionMode = async function toggleProductionMode() {
    if (session?.role !== "Administrateur") return alert("Seul l'administrateur peut changer le mode production.");
    const next = !productionEnabled();
    const message = next
      ? "Activer le mode production ? Les imports, restaurations et réinitialisations seront bloqués."
      : "Désactiver le mode production ? Les actions dangereuses redeviendront disponibles.";
    if (!(await confirmDialog(message, { danger: !next, okLabel: next ? "Activer" : "Désactiver" }))) return;
    state.productionMode = next;
    log(`${next ? "Mode production activé" : "Mode production désactivé"}`, "Sécurité");
    saveState();
    pages.system();
  };

  window.cleanTestDataFromSystem = async function cleanTestDataFromSystem() {
    if (productionEnabled()) return alert("Mode production actif : nettoyage bloqué.");
    if (!requireAction("backup")) return;
    if (!(await confirmDialog("Nettoyer les données de test connues ? Faites une sauvegarde avant si nécessaire."))) return;
    if (originalRemoveDemoData) return originalRemoveDemoData();
  };

  function blockInProduction(label) {
    if (!productionEnabled()) return false;
    alert(`${label} bloqué : le mode production est activé.`);
    log(`Action bloquée en production : ${label}`, "Sécurité");
    return true;
  }

  if (originalRemoveDemoData) removeDemoData = async function guardedRemoveDemoData() {
    if (blockInProduction("Suppression des données démo/test")) return;
    return originalRemoveDemoData.apply(this, arguments);
  };

  if (originalResetApp) resetApp = async function guardedResetApp() {
    if (blockInProduction("Réinitialisation")) return;
    return originalResetApp.apply(this, arguments);
  };

  if (originalImportBackup) importBackup = function guardedImportBackup() {
    if (blockInProduction("Import JSON")) return;
    return originalImportBackup.apply(this, arguments);
  };

  if (originalRestoreLocalBackup) restoreLocalBackup = async function guardedRestoreLocalBackup() {
    if (blockInProduction("Restauration locale")) return;
    return originalRestoreLocalBackup.apply(this, arguments);
  };

  ensureSystemMenu();

  if (originalRenderShell) {
    renderShell = function renderShellWithSystemPage() {
      ensureSystemMenu();
      return originalRenderShell.apply(this, arguments);
    };
  }
})();
