// Calculs financiers : les fonctions indexées (due/paid/student) doivent
// donner EXACTEMENT les mêmes montants que la force brute, et l'index doit
// s'invalider après ajout / suppression / modification sur place.
module.exports = (app, t) => {
  const { normalizeState, due, paid, student, classFee, enrollmentNet } = app;

  const N = 400;
  const classes = [{ id: "CLS-1", name: "CP1", level: "Primaire", fee: 100000 }];
  const students = [], enrollments = [], payments = [];
  for (let i = 0; i < N; i++) {
    const sid = "ELV-" + i;
    students.push({ id: sid, matricule: "M-" + i, name: "E" + i, className: "CP1", year: "2026-2027" });
    enrollments.push({ id: "INS-" + i, studentId: sid, className: "CP1", year: "2026-2027", amount: 100000, discount: 0 });
    payments.push({ id: "PAY-a" + i, studentId: sid, year: "2026-2027", amount: 40000 });
    if (i % 2 === 0) payments.push({ id: "PAY-b" + i, studentId: sid, year: "2026-2027", amount: 20000 });
  }
  app.state = normalizeState({
    school: { name: "T", code: "T", year: "2026-2027" }, activeYear: "2026-2027",
    years: ["2026-2027"], classes, students, enrollments, payments,
    users: [{ id: "USR-A", login: "admin", role: "Administrateur", active: true }],
  });

  const bfPaid = (id, y) => app.state.payments.filter((p) => p.studentId === id && p.year === y).reduce((s, p) => s + Number(p.amount || 0), 0);
  const bfDue = (id, y) => {
    const se = app.state.enrollments.filter((e) => e.studentId === id);
    const r = se.filter((e) => e.year === y);
    if (!r.length && se.length) return 0;
    if (!r.length) return classFee(app.state.classes, student(id).className);
    return r.reduce((s, e) => s + enrollmentNet(e), 0);
  };

  let identical = true;
  for (const s of app.state.students) {
    if (paid(s.id) !== bfPaid(s.id, "2026-2027") || due(s.id) !== bfDue(s.id, "2026-2027")) identical = false;
  }
  t.ok(identical, "finance: résultats indexés identiques à la force brute (tous les élèves)");

  // Invalidation après AJOUT (push).
  const before = paid("ELV-0");
  app.state.payments.push({ id: "PAY-new", studentId: "ELV-0", year: "2026-2027", amount: 5000 });
  t.eq(paid("ELV-0"), before + 5000, "finance: paid() reflète un paiement ajouté");

  // Invalidation après SUPPRESSION (filter -> nouvelle référence).
  app.state.students = app.state.students.filter((s) => s.id !== "ELV-1");
  t.ok(!student("ELV-1").id, "finance: student() ne trouve plus un élève supprimé");

  // Invalidation après MODIFICATION SUR PLACE (Object.assign).
  Object.assign(app.state.students.find((s) => s.id === "ELV-2"), { name: "Modifié" });
  t.eq(student("ELV-2").name, "Modifié", "finance: student() reflète une modification sur place");
};
