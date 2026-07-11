// Reçus / identifiants : l'id interne d'un paiement est unique et ne peut pas
// être « recyclé », donc une ancienne tombstone ne supprime jamais un nouveau
// paiement (protection contre la perte d'un encaissement).
module.exports = (app, t) => {
  const { mergeStates, normalizeState, uid } = app;

  // Unicité des identifiants générés.
  {
    const set = new Set();
    for (let i = 0; i < 5000; i++) set.add(uid("PAY"));
    t.eq(set.size, 5000, "reçu: 5000 identifiants uid uniques");
  }

  // Un nouveau paiement (id unique) avec un numéro de reçu recyclé survit à
  // une tombstone portant sur un ANCIEN id.
  {
    const remote = normalizeState({ payments: [], tombstones: [{ id: "PAY-OLD1", at: "2026-07-09T10:00:00Z" }], updatedAt: "2026-07-09T10:00:00Z" });
    const local = normalizeState({ payments: [{ id: "PAY-NEW9", receiptNo: "REC-2026-0001", studentId: "ELV-1", year: "2026-2027", amount: 5000 }], updatedAt: "2026-07-09T11:00:00Z" });
    const merged = mergeStates(local, remote);
    t.ok(merged.payments.some((p) => p.id === "PAY-NEW9"), "reçu: le nouveau paiement survit malgré un numéro de reçu identique");
    t.ok(!merged.payments.some((p) => p.id === "PAY-OLD1"), "reçu: l'ancien id supprimé reste supprimé");
  }
};
