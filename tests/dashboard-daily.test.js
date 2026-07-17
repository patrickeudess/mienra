const fs = require("fs");
const path = require("path");

module.exports = (_app, t) => {
  const root = path.join(__dirname, "..");
  const dashboard = fs.readFileSync(path.join(root, "dashboard-role-fix.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

  t.ok(dashboard.includes("function dailyPaymentSummary()"), "dashboard: synthese journaliere centralisee");
  t.ok(dashboard.includes('row.year === currentYear()'), "dashboard: paiements limites a l'annee active");
  t.ok(dashboard.includes('String(row.date || "").slice(0, 10) === date'), "dashboard: paiements limites au jour courant");
  t.ok(dashboard.includes('Reçus générés aujourd\'hui'), "dashboard: nombre de recus du jour affiche");
  t.ok(dashboard.includes('Montant encaissé aujourd\'hui'), "dashboard: montant du jour affiche");
  t.eq((dashboard.match(/\$\{dailySummaryBlock\(\)\}/g) || []).length, 2, "dashboard: point du jour affiche pour les deux interfaces");
  t.ok(index.includes("dashboard-role-fix.js?v=20260717-daily-summary"), "deploiement: nouvelle version forcee dans le navigateur");
};
