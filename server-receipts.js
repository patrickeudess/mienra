// MIENRA Web - Reçus sécurisés côté Supabase
// Charge après relational-sync.js. Quand Supabase relationnel est disponible,
// le numéro de reçu vient de la fonction RPC mienra_next_receipt_no afin
// d'éviter les doublons si deux personnes encaissent en même temps.

(() => {
  if (typeof savePayment !== "function") return;

  const originalSavePayment = savePayment;

  async function serverReceiptNumber() {
    try {
      if (!supabaseAuthAvailable() || !authSession || typeof getSupabase !== "function") return null;
      const sb = getSupabase();
      const { data, error } = await sb.rpc("mienra_next_receipt_no", {
        p_school_slug: "epv-mienrassou",
        p_year_name: currentYear(),
        p_prefix: state.school.receiptPrefix || "REC"
      });
      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn("Compteur serveur indisponible, repli local:", error?.message || error);
      return null;
    }
  }

  async function savePaymentWithServerReceipt() {
    if (!requireAction("payments")) return;
    const studentId = $("payStudent").value;
    const amount = Number($("payAmount").value || 0);
    if (amount <= 0) return alert("Le montant doit être supérieur à zéro.");

    const expectedAtPayment = due(studentId);
    const paidBefore = paid(studentId);
    const balanceBefore = expectedAtPayment - paidBefore;
    if (expectedAtPayment <= 0) return alert("Aucun frais n'est défini pour cet élève sur l'année scolaire sélectionnée.");
    if (balanceBefore <= 0) return alert("Cet élève est déjà soldé pour cette année scolaire. Aucun nouveau reçu ne peut être créé.");
    if (balanceBefore > 0 && amount > balanceBefore) return alert(`Le montant saisi dépasse le reste à payer (${money(balanceBefore)}).`);

    const receiptNo = await serverReceiptNumber() || nextReceiptNumber();
    const payment = {
      id: uid("PAY"),
      receiptNo,
      studentId,
      year: currentYear(),
      amount,
      expectedAtPayment,
      paidBefore,
      totalPaidAfter: paidBefore + amount,
      balanceAfter: expectedAtPayment - paidBefore - amount,
      paidBy: $("paidBy").value.trim() || student(studentId).parent || "",
      mode: $("payMode").value,
      date: $("payDate").value,
      cashier: $("cashier").value,
      note: $("payNote").value
    };

    state.payments.unshift(payment);
    activeReceipt = payment.id;
    log(`Paiement enregistré : ${student(studentId).name} - ${money(amount)}`, "Paiement", `Reçu : ${receiptNo} · Payé par : ${payment.paidBy || "-"}`);
    saveState();
    view = "receipts";
    renderNav();
    receiptView();
  }

  savePayment = savePaymentWithServerReceipt;
  window.mienraRecuServeur = {
    prochainNumero: serverReceiptNumber,
    repliLocal: originalSavePayment
  };
})();
