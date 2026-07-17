const fs = require("fs");
const path = require("path");

module.exports = (_app, t) => {
  const root = path.join(__dirname, "..");
  const hardening = fs.readFileSync(path.join(root, "production-hardening.js"), "utf8");
  const receiptPdf = fs.readFileSync(path.join(root, "receipt-pdf-download.js"), "utf8");
  const sql = fs.readFileSync(path.join(root, "supabase", "cross-device-consistency.sql"), "utf8");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

  t.ok(hardening.includes('rpc("mienra_save_student"'), "sync: eleve confirme par une RPC serveur");
  t.ok(hardening.includes('rpc("mienra_save_enrollment"'), "sync: inscription confirmee par une RPC serveur");
  t.ok(hardening.includes("setInterval(autoRefreshFromSupabase, 15000)"), "sync: actualisation automatique multi-appareils");
  t.ok(hardening.includes("pushSharedState = async function confirmedWritesOnly()"), "sync: reecriture globale de la base neutralisee");
  t.ok(hardening.includes('session?.role === "Administrateur" && canAction("deleteStudents")'), "droits: suppression eleve affichee seulement a administrateur");
  t.ok(sql.includes("create or replace function public.mienra_save_student"), "sql: fonction d'ecriture eleve presente");
  t.ok(sql.includes("pg_advisory_xact_lock"), "sql: concurrence protegee par verrou transactionnel");
  t.ok(receiptPdf.includes('drawReceipt(doc, payment, "Exemplaire parent", 10, logoData)'), "recu: exemplaire parent sur le PDF");
  t.ok(receiptPdf.includes('drawReceipt(doc, payment, "Exemplaire archive", 156, logoData)'), "recu: exemplaire archive sur le meme PDF");
  t.ok(receiptPdf.includes('doc.addImage(logoData, "JPEG"'), "recu: logo officiel integre au PDF");
  t.ok(index.includes("production-hardening.js?v=20260717-cross-device"), "deploiement: cle de cache du correctif actualisee");
};
