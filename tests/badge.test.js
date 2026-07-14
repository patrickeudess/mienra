// Badges de statut : statusBadge() est réservé à l'AFFICHAGE (HTML) tandis
// que financeStatus() doit rester du texte brut — il alimente les exports CSV
// et les rapports imprimés. Ce test verrouille cette séparation.
module.exports = (app, t) => {
  const { statusBadge, financeStatus, normalizeState, currentYear } = app;

  // Tonalité correcte pour chaque libellé connu.
  t.ok(statusBadge("Soldé").includes("badge-ok"), "badge: Soldé → tonalité verte");
  t.ok(statusBadge("Partiel").includes("badge-warn"), "badge: Partiel → tonalité ambre");
  t.ok(statusBadge("Impayé").includes("badge-danger"), "badge: Impayé → tonalité rouge");
  t.ok(statusBadge("Sans frais").includes("badge-muted"), "badge: Sans frais → tonalité neutre");
  t.ok(statusBadge("Libellé inconnu").includes("badge-muted"), "badge: libellé inconnu → tonalité neutre par défaut");

  // Le libellé est échappé : aucun HTML injecté ne survit.
  {
    const out = statusBadge('<img src=x onerror=alert(1)>');
    t.ok(!out.includes("<img"), "badge: le HTML du libellé est échappé");
    t.ok(out.includes("&lt;img"), "badge: échappement conservé dans la sortie");
  }

  // financeStatus() reste du TEXTE BRUT (contrat CSV / impression).
  {
    const y = currentYear();
    app.state = normalizeState({
      classes: [{ id: "CLS-1", name: "CM2", level: "Primaire", fee: 75000 }],
      students: [
        { id: "ELV-1", name: "Sans classe connue", className: "Inexistante" },
        { id: "ELV-2", name: "Jamais payé", className: "CM2" },
        { id: "ELV-3", name: "Tout payé", className: "CM2" }
      ],
      enrollments: [],
      payments: [{ id: "PAY-1", studentId: "ELV-3", year: y, amount: 75000 }]
    });
    t.eq(financeStatus({ id: "ELV-1" }), "Sans frais", "financeStatus: aucun frais → « Sans frais »");
    t.eq(financeStatus({ id: "ELV-2" }), "Impayé", "financeStatus: rien payé → « Impayé »");
    t.eq(financeStatus({ id: "ELV-3" }), "Soldé", "financeStatus: tout payé → « Soldé »");
    ["ELV-1", "ELV-2", "ELV-3"].forEach((id) => {
      t.ok(!financeStatus({ id }).includes("<"), `financeStatus: ${id} sans balise HTML (contrat CSV)`);
    });
  }
};
