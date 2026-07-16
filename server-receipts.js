// MIENRA Web - Reçus sécurisés côté Supabase
// Charge après relational-sync.js. Quand Supabase relationnel est disponible,
// le numéro de reçu vient de la fonction RPC mienra_next_receipt_no afin
// d'éviter les doublons si deux personnes encaissent en même temps.

(() => {
  if (typeof savePayment !== "function") return;

  const originalSavePayment = savePayment;
  const originalRenderShell = typeof renderShell === "function" ? renderShell : null;
  let repairDone = false;

  function receiptNumberValue(value) {
    const n = parseInt(String(value || "").split("-").pop(), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function usedReceiptNumbers(exceptPaymentId = "") {
    return new Set(state.payments
      .filter((row) => row.id !== exceptPaymentId)
      .map((row) => row.receiptNo || row.id)
      .filter(Boolean));
  }

  function nextLocalUniqueReceiptNumber(used = usedReceiptNumbers()) {
    const max = state.payments.reduce((highest, row) => Math.max(highest, receiptNumberValue(row.receiptNo || row.id)), Number(state.receiptSeq || 0));
    state.receiptSeq = Math.max(Number(state.receiptSeq || 0), max);
    let receiptNo = "";
    do {
      state.receiptSeq += 1;
      receiptNo = `${state.school.receiptPrefix || "REC"}-${new Date().getFullYear()}-${String(state.receiptSeq).padStart(4, "0")}`;
    } while (used.has(receiptNo));
    used.add(receiptNo);
    return receiptNo;
  }

  function repairDuplicateReceiptNumbers({ silent = true } = {}) {
    const used = new Set();
    let changed = 0;
    state.payments
      .slice()
      .reverse()
      .forEach((payment) => {
        const current = payment.receiptNo || payment.id;
        if (!current || used.has(current)) {
          payment.receiptNo = nextLocalUniqueReceiptNumber(used);
          changed += 1;
        } else {
          used.add(current);
          state.receiptSeq = Math.max(Number(state.receiptSeq || 0), receiptNumberValue(current));
        }
      });
    if (changed) {
      state.updatedAt = new Date().toISOString();
      saveLocalState();
      pushSharedState();
      if (!silent) notify(`${changed} doublon(s) de reçu corrigé(s).`, "success", 4000);
    }
    return changed;
  }

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

  async function uniqueReceiptNumber() {
    const used = usedReceiptNumbers();
    for (let i = 0; i < 5; i += 1) {
      const receiptNo = await serverReceiptNumber();
      if (receiptNo && !used.has(receiptNo)) return receiptNo;
      if (receiptNo) console.warn(`Numéro de reçu déjà utilisé ignoré: ${receiptNo}`);
    }
    return nextLocalUniqueReceiptNumber(used);
  }

  async function savePaymentWithServerReceipt() {
    if (!requireAction("payments")) return;
    repairDuplicateReceiptNumbers();
    const studentId = $("payStudent").value;
    const amount = Number($("payAmount").value || 0);
    if (amount <= 0) return alert("Le montant doit être supérieur à zéro.");

    const expectedAtPayment = due(studentId);
    const paidBefore = paid(studentId);
    const balanceBefore = expectedAtPayment - paidBefore;
    if (expectedAtPayment <= 0) return alert("Aucun frais n'est défini pour cet élève sur l'année scolaire sélectionnée.");
    if (balanceBefore <= 0) return alert("Cet élève est déjà soldé pour cette année scolaire. Aucun nouveau reçu ne peut être créé.");
    if (balanceBefore > 0 && amount > balanceBefore) return alert(`Le montant saisi dépasse le reste à payer (${money(balanceBefore)}).`);

    const receiptNo = await uniqueReceiptNumber();
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
      date: $("payDate").value || today(),
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

  if (originalRenderShell) {
    renderShell = function renderShellWithReceiptRepair() {
      if (!repairDone && session) {
        repairDone = true;
        repairDuplicateReceiptNumbers();
      }
      return originalRenderShell();
    };
  }

  window.mienraRecuServeur = {
    prochainNumero: serverReceiptNumber,
    reparerDoublons: () => repairDuplicateReceiptNumbers({ silent: false }),
    repliLocal: originalSavePayment
  };
})();
