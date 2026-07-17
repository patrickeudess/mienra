// MIENRA Web - téléchargement PDF direct des reçus
// Génère une page A4 avec deux exemplaires : parent et archive.

(() => {
  const PDF_CDN_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
  let pdfLibraryPromise = null;

  function pdfReady() {
    return !!window.jspdf?.jsPDF;
  }

  function ensurePdfLibrary() {
    if (pdfReady()) return Promise.resolve(true);
    if (pdfLibraryPromise) return pdfLibraryPromise;

    pdfLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDF_CDN_URL;
      script.async = true;
      script.dataset.mienraPdfFallback = "true";
      script.onload = () => pdfReady()
        ? resolve(true)
        : reject(new Error("jsPDF indisponible apres chargement"));
      script.onerror = () => reject(new Error("Chargement de jsPDF impossible"));
      document.head.appendChild(script);
    }).catch((error) => {
      pdfLibraryPromise = null;
      throw error;
    });

    return pdfLibraryPromise;
  }

  function currentReceiptId() {
    return typeof activeReceipt !== "undefined" ? activeReceipt : window.activeReceipt;
  }

  function receiptFileName(payment) {
    const receipt = String(payment?.receiptNo || payment?.id || "recu").replace(/[^a-z0-9-]+/gi, "-");
    const row = student(payment.studentId);
    const name = String(row?.name || "eleve").replace(/[^a-z0-9-]+/gi, "-");
    return `${receipt}-${name}.pdf`;
  }

  function addLine(doc, label, value, x, y, rightX) {
    doc.setFont("helvetica", "bold");
    doc.text(String(label), x, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || "-"), rightX, y, { align: "right" });
  }

  function loadLogoData() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          canvas.getContext("2d").drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch (_) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = typeof logoUrl === "function" ? logoUrl() : "assets/mienra-logo.jpeg";
    });
  }

  function drawReceipt(doc, payment, copyLabel, y0, logoData) {
    const row = student(payment.studentId);
    const amounts = receiptAmounts(payment);
    const x = 12;
    const w = 186;
    const right = x + w - 8;
    let y = y0;

    doc.setFillColor(248, 250, 253);
    doc.setDrawColor(170, 188, 210);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, 126, 2, 2, "FD");

    if (logoData) {
      try { doc.addImage(logoData, "JPEG", x + 7, y + 5, 27, 27, undefined, "FAST"); }
      catch (_) { /* Le texte d'identite reste visible en secours. */ }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(copyLabel, right, y + 7, { align: "right" });

    doc.setTextColor(10, 45, 85);
    doc.setFontSize(11);
    const schoolX = logoData ? x + 39 : x + 8;
    doc.text("ECOLE MATERNELLE ET PRIMAIRE", schoolX, y + 12);
    doc.setFontSize(9);
    doc.text("Ecole primaire et privee", schoolX, y + 18);
    doc.setFontSize(13);
    doc.text("MIENRASSOU - DALOA", schoolX, y + 25);
    doc.setFontSize(9);
    doc.text("Tel : 07 07 70 44 54", schoolX, y + 31);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("RECU DE PAIEMENT", right, y + 24, { align: "right" });
    doc.setFontSize(10);
    doc.text(payment.receiptNo || payment.id, right, y + 31, { align: "right" });

    y += 43;
    doc.setDrawColor(230, 235, 242);
    doc.line(x + 8, y - 5, right, y - 5);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    const leftX = x + 8;
    const valueX = right;
    const lines = [
      ["Annee scolaire", payment.year || currentYear()],
      ["Date", payment.date],
      ["Eleve", row.name],
      ["Matricule", row.matricule],
      ["Classe", row.className],
      ["Paye par", paymentPayer(payment)],
      ["Mode", payment.mode],
      ["Frais de scolarite", money(amounts.expected)],
      ["Versement recu", money(amounts.currentPaid)],
      ["Total paye a ce jour", money(amounts.totalPaid)],
      ["Reste a payer", money(amounts.remaining)]
    ];

    lines.forEach(([label, value]) => {
      addLine(doc, label, value, leftX, y, valueX);
      y += 6.4;
    });

    if (amounts.remaining <= 0) {
      doc.setTextColor(0, 120, 80);
      doc.setFont("helvetica", "bold");
      doc.text("Mention : SOLDE", leftX, y + 2);
      doc.setTextColor(0, 0, 0);
      y += 7;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Observation : ${payment.note || "-"}`, leftX, y + 2);
    y += 12;

    doc.setFontSize(8);
    doc.text("Caissier", leftX, y);
    doc.setFont("helvetica", "bold");
    doc.text(payment.cashier || "-", leftX, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text("Direction", right - 52, y);
    doc.setFont("helvetica", "bold");
    doc.text(state.school.director || "Direction", right - 52, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(85, 85, 85);
    doc.text(state.school.receiptFooter || "Merci pour votre paiement.", leftX, y0 + 120);
    doc.setTextColor(0, 0, 0);
  }

  function activePaymentIdFromPage() {
    const id = currentReceiptId();
    if (id && state.payments.some((row) => row.id === id)) return id;
    const receiptText = [...document.querySelectorAll(".receipt-copy p")]
      .map((node) => node.textContent.trim())
      .find((text) => text.startsWith("Reçu") || text.startsWith("Recu"));
    const receiptNo = receiptText?.replace(/^Re[çc]u\s*/i, "").trim();
    const found = receiptNo ? state.payments.find((row) => row.receiptNo === receiptNo || row.id === receiptNo) : null;
    return found?.id || id;
  }

  function ensureReceiptActions() {
    const actions = document.querySelector(".receipt-actions");
    if (!actions) return;

    if (!actions.querySelector("[data-pdf-receipt]")) {
      const paymentId = activePaymentIdFromPage();
      const attr = paymentId ? ` data-payment-id="${clean(paymentId)}"` : "";
      actions.insertAdjacentHTML(
        "afterbegin",
        `<button type="button" class="btn primary receipt-action" data-pdf-receipt${attr} onclick="downloadReceiptPdf(this.dataset.paymentId)">Télécharger le PDF</button>`
      );
    }

    const printButton = actions.querySelector('[data-print-receipt], button[onclick="window.print()"]');
    if (printButton) {
      printButton.setAttribute("onclick", "printReceipt()");
      printButton.dataset.printReceipt = "true";
      printButton.classList.add("receipt-action");
      if (printButton.textContent !== "Imprimer le reçu") printButton.textContent = "Imprimer le reçu";
    }
  }

  window.printReceipt = function printReceipt() {
    if (!document.querySelector(".receipt-page")) {
      return alert("Aucun reçu disponible à imprimer.");
    }
    requestAnimationFrame(() => window.print());
  };

  window.downloadReceiptPdf = async function downloadReceiptPdf(id) {
    const selectedId = id || activePaymentIdFromPage();
    const payment = state.payments.find((row) => row.id === selectedId) || state.payments[0];
    if (!payment) return alert("Aucun reçu disponible.");
    const button = document.activeElement?.tagName === "BUTTON" ? document.activeElement : null;
    const label = button?.textContent || "";
    if (button) { button.disabled = true; button.textContent = "Preparation du PDF..."; }
    try {
      await ensurePdfLibrary();
      const logoData = await loadLogoData();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      drawReceipt(doc, payment, "Exemplaire parent", 10, logoData);
      doc.setDrawColor(135, 145, 160);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(10, 143.5, 200, 143.5);
      doc.setLineDashPattern([], 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 105, 115);
      doc.text("Decouper ici", 105, 147, { align: "center" });
      doc.setTextColor(0, 0, 0);
      drawReceipt(doc, payment, "Exemplaire archive", 156, logoData);
      doc.save(receiptFileName(payment));
    } catch (error) {
      console.error("Génération du reçu PDF :", error);
      alert("Le PDF n'a pas pu être préparé. Utilisez le bouton Imprimer le reçu.");
    } finally {
      if (button) { button.disabled = false; button.textContent = label; }
    }
  };

  const originalReceiptView = typeof receiptView === "function" ? receiptView : null;
  if (originalReceiptView) {
    receiptView = function receiptViewWithPdfDownload() {
      const result = originalReceiptView.apply(this, arguments);
      ensureReceiptActions();
      return result;
    };
  }

  document.addEventListener("DOMContentLoaded", ensureReceiptActions);
  new MutationObserver(ensureReceiptActions).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
