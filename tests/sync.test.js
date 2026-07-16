// Synchronisation : les suppressions doivent être DÉFINITIVES (tombstones),
// sans perdre les ajouts faits sur un autre poste.
const mkStudent = (id) => ({ id, matricule: id, firstName: "A", lastName: id, name: id, className: "CP1", year: "2026-2027" });

module.exports = (app, t) => {
  const { mergeStates, normalizeState } = app;

  // 1) Suppression sur le cloud, ancien enregistrement encore en local.
  {
    const remote = normalizeState({ students: [mkStudent("STU-2")], tombstones: [{ id: "STU-1", at: "2026-07-09T10:00:00Z" }], updatedAt: "2026-07-09T10:00:00Z" });
    const local = normalizeState({ students: [mkStudent("STU-1"), mkStudent("STU-2")], tombstones: [], updatedAt: "2026-07-09T09:00:00Z" });
    const merged = mergeStates(local, remote);
    const ids = merged.students.map((s) => s.id);
    t.ok(!ids.includes("STU-1"), "sync: un élève supprimé ne revient pas après fusion");
    t.ok(ids.includes("STU-2"), "sync: un élève non supprimé est conservé");
    t.ok(merged.tombstones.some((x) => x.id === "STU-1"), "sync: la tombstone est propagée");
  }

  // 2) Un ajout local n'est pas perdu même si le cloud est plus récent.
  {
    const remote = normalizeState({ students: [mkStudent("STU-1")], tombstones: [], updatedAt: "2026-07-09T10:00:00Z" });
    const local = normalizeState({ students: [mkStudent("STU-1"), mkStudent("STU-9")], tombstones: [], updatedAt: "2026-07-09T09:00:00Z" });
    const ids = mergeStates(local, remote).students.map((s) => s.id);
    t.ok(ids.includes("STU-9"), "sync: un ajout local est conservé malgré un cloud plus récent");
  }

  // 3) Idempotence : re-fusionner ne ressuscite jamais.
  {
    const remote = normalizeState({ students: [], tombstones: [{ id: "STU-1", at: "2026-07-09T10:00:00Z" }], updatedAt: "2026-07-09T10:00:00Z" });
    let merged = mergeStates(normalizeState({ students: [mkStudent("STU-1")], updatedAt: "2026-07-09T09:00:00Z" }), remote);
    merged = mergeStates(merged, remote);
    merged = mergeStates(merged, normalizeState({ students: [mkStudent("STU-1")], updatedAt: "2026-07-09T08:00:00Z" }));
    t.ok(!merged.students.map((s) => s.id).includes("STU-1"), "sync: après plusieurs fusions, la suppression tient");
  }

  // 3bis) Fusion avant écriture (read-modify-write) : deux appareils qui
  // encaissent en parallèle ne s'écrasent pas. Chacun fusionne l'état distant
  // AVANT d'écrire, donc les DEUX paiements survivent.
  {
    const distantAvantEcriture = normalizeState({ payments: [{ id: "PAY-B", studentId: "STU-1", year: "2026-2027", amount: 5000 }], updatedAt: "2026-07-09T10:05:00Z" });
    const localAppareilA = normalizeState({ payments: [{ id: "PAY-A", studentId: "STU-1", year: "2026-2027", amount: 3000 }], updatedAt: "2026-07-09T10:00:00Z" });
    const aEcrire = mergeStates(localAppareilA, distantAvantEcriture);
    const ids = aEcrire.payments.map((p) => p.id);
    t.ok(ids.includes("PAY-A") && ids.includes("PAY-B"), "sync: fusion avant écriture — les deux paiements concurrents sont conservés");
  }

  // 4) Cascade élève -> inscriptions / paiements.
  {
    const remote = normalizeState({ enrollments: [{ id: "INS-1", studentId: "STU-1" }], payments: [{ id: "PAY-1", studentId: "STU-1", year: "2026-2027", amount: 1 }], updatedAt: "2026-07-09T09:00:00Z" });
    const local = normalizeState({ tombstones: [{ id: "INS-1", at: "2026-07-09T10:00:00Z" }, { id: "PAY-1", at: "2026-07-09T10:00:00Z" }], updatedAt: "2026-07-09T10:00:00Z" });
    const merged = mergeStates(local, remote);
    t.ok(!merged.enrollments.some((e) => e.id === "INS-1"), "sync: inscription liée supprimée ne revient pas");
    t.ok(!merged.payments.some((p) => p.id === "PAY-1"), "sync: paiement lié supprimé ne revient pas");
  }
};
