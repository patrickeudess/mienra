// MIENRA Web - dernier verrouillage pour l'exploitation reelle.

(() => {
  const SCHOOL_SLUG = "epv-mienrassou";
  const LOCAL_RECOVERY_KEY = "mienra_unsynced_recovery_v1";
  const LOCAL_RECOVERY_DISMISSED_KEY = "mienra_unsynced_recovery_dismissed_v1";
  const authoritativePull = pullSharedState;
  let paymentSaving = false;
  let writeSaving = false;
  let recoveryChecked = false;
  let autoRefreshRunning = false;

  if (roleAccess?.Administrateur && !roleAccess.Administrateur.actions.includes("deleteStudents")) {
    roleAccess.Administrateur.actions.push("deleteStudents");
  }
  ["Directeur", "Secrétaire", "Consultation"].forEach((role) => {
    if (roleAccess?.[role]) {
      roleAccess[role].actions = roleAccess[role].actions.filter((action) => action !== "deleteStudents");
    }
  });

  const baseRenderLogin = renderLogin;
  renderLogin = function renderLoginWithoutTechnicalMode() {
    baseRenderLogin.apply(this, arguments);
    document.querySelector(".login-panel .hint")?.remove();
  };

  const baseRenderShell = renderShell;
  renderShell = function renderShellWithoutTechnicalMode() {
    baseRenderShell.apply(this, arguments);
    const accountLabel = document.querySelector(".account > span");
    if (accountLabel) accountLabel.textContent = session?.role || "";
  };

  const cloudReady = () => (
    typeof getSupabase === "function"
    && supabaseAuthAvailable()
    && !!authSession
  );

  function rpcErrorMessage(error, fallback) {
    const raw = error?.message || error?.details || fallback;
    return String(raw || fallback).replace(/^.*exception:\s*/i, "");
  }

  function studentRpcArgs(row) {
    return {
      p_school_slug: SCHOOL_SLUG,
      p_student_ref: row.id,
      p_matricule: row.matricule,
      p_name: row.name,
      p_gender: row.gender,
      p_birth: row.birth || null,
      p_entry_date: row.entryDate || null,
      p_added_date: row.addedDate || today(),
      p_class_name: row.className,
      p_parent_name: row.parent || "",
      p_phone: row.phone || "",
      p_address: row.address || "",
      p_status: row.status || "Actif"
    };
  }

  function enrollmentRpcArgs(row) {
    return {
      p_school_slug: SCHOOL_SLUG,
      p_enrollment_ref: row.id,
      p_student_ref: row.studentId,
      p_year_name: row.year || currentYear(),
      p_class_name: row.className,
      p_amount: Number(row.amount || 0),
      p_discount: Number(row.discount || 0),
      p_enrolled_on: row.date || today(),
      p_note: row.note || ""
    };
  }

  async function rpc(functionName, args) {
    const { data, error } = await getSupabase().rpc(functionName, args);
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  function localRecoveryFingerprint(snapshot) {
    return [
      ...snapshot.students.map((row) => `E:${row.id}:${row.matricule}`),
      ...snapshot.enrollments.map((row) => `I:${row.id}`),
      ...snapshot.payments.map((row) => `P:${row.id}`)
    ].sort().join("|");
  }

  function parseLocalRecoveryCandidate(raw) {
    if (!raw) return null;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return normalizeState(parsed?.data || parsed);
    } catch {
      return null;
    }
  }

  function mergeLocalRows(candidates, collection, sameRow) {
    const merged = [];
    candidates.forEach((candidate) => {
      (candidate?.[collection] || []).forEach((row) => {
        if (!row || !row.id) return;
        const existing = merged.find((item) => sameRow(item, row));
        if (!existing) {
          merged.push({ ...row });
          return;
        }
        Object.entries(row).forEach(([key, value]) => {
          const current = existing[key];
          if ((current === "" || current == null) && value !== "" && value != null) existing[key] = value;
        });
      });
    });
    return merged;
  }

  function collectLocalRecoveryState() {
    const candidates = [
      parseLocalRecoveryCandidate(JSON.parse(JSON.stringify(state))),
      parseLocalRecoveryCandidate(localStorage.getItem(DB_KEY)),
      parseLocalRecoveryCandidate(localStorage.getItem(DB_BACKUP_KEY)),
      parseLocalRecoveryCandidate(localStorage.getItem(LOCAL_RECOVERY_KEY))
    ].filter(Boolean);
    return {
      students: mergeLocalRows(candidates, "students", (left, right) => (
        left.id === right.id || (left.matricule && right.matricule && left.matricule === right.matricule)
      )),
      enrollments: mergeLocalRows(candidates, "enrollments", (left, right) => left.id === right.id),
      payments: mergeLocalRows(candidates, "payments", (left, right) => left.id === right.id)
    };
  }

  async function recoverLocalOnlyData({ force = false } = {}) {
    if (recoveryChecked || !cloudReady()) return;
    recoveryChecked = true;

    // Avant la premiere lecture autoritaire du serveur, inspecter toutes les
    // copies encore disponibles sur cet appareil. Une actualisation ancienne
    // peut avoir laisse la saisie disparue dans DB_BACKUP_KEY.
    const local = collectLocalRecoveryState();
    if (!local.students.length && !local.enrollments.length && !local.payments.length) return;

    try {
      const sb = getSupabase();
      const { data: school, error: schoolError } = await sb
        .from("schools").select("id").eq("slug", SCHOOL_SLUG).single();
      if (schoolError) throw schoolError;

      const [studentsRes, enrollmentsRes, paymentsRes] = await Promise.all([
        sb.from("students").select("legacy_id,matricule").eq("school_id", school.id),
        sb.from("enrollments").select("legacy_id").eq("school_id", school.id),
        sb.from("payments").select("legacy_id").eq("school_id", school.id)
      ]);
      const firstError = [studentsRes, enrollmentsRes, paymentsRes].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const serverStudentIds = new Set((studentsRes.data || []).map((row) => row.legacy_id).filter(Boolean));
      const serverMatricules = new Set((studentsRes.data || []).map((row) => row.matricule).filter(Boolean));
      const serverEnrollmentIds = new Set((enrollmentsRes.data || []).map((row) => row.legacy_id).filter(Boolean));
      const serverPaymentIds = new Set((paymentsRes.data || []).map((row) => row.legacy_id).filter(Boolean));
      const snapshot = {
        savedAt: new Date().toISOString(),
        students: local.students.filter((row) => row.id && row.matricule && row.name && !serverStudentIds.has(row.id) && !serverMatricules.has(row.matricule)),
        enrollments: local.enrollments.filter((row) => row.id && !serverEnrollmentIds.has(row.id)),
        payments: local.payments.filter((row) => row.id && Number(row.amount || 0) > 0 && !serverPaymentIds.has(row.id))
      };
      if (!snapshot.students.length && !snapshot.enrollments.length && !snapshot.payments.length) return;

      localStorage.setItem(LOCAL_RECOVERY_KEY, JSON.stringify(snapshot));
      const fingerprint = localRecoveryFingerprint(snapshot);
      if (!force && localStorage.getItem(LOCAL_RECOVERY_DISMISSED_KEY) === fingerprint) return;

      const recover = await confirmDialog(
        `Cet appareil contient ${snapshot.students.length} eleve(s), ${snapshot.enrollments.length} inscription(s) et ${snapshot.payments.length} paiement(s) absents de Supabase. Voulez-vous les recuperer maintenant ?`,
        { danger: false, okLabel: "Recuperer", cancelLabel: "Plus tard" }
      );
      if (!recover) {
        localStorage.setItem(LOCAL_RECOVERY_DISMISSED_KEY, fingerprint);
        notify("Une copie locale de recuperation a ete conservee sur cet appareil.", "warn", 7000);
        return;
      }

      const failures = [];
      const serverStudents = studentsRes.data || [];
      const studentReference = (localId) => {
        const appStudent = local.students.find((row) => row.id === localId);
        const remote = serverStudents.find((row) =>
          row.legacy_id === localId || (appStudent?.matricule && row.matricule === appStudent.matricule)
        );
        return remote?.legacy_id || remote?.matricule || localId;
      };
      for (const row of snapshot.students) {
        try { await rpc("mienra_save_student", studentRpcArgs(row)); }
        catch (error) { failures.push(`Eleve ${row.name}: ${rpcErrorMessage(error, "echec")}`); }
      }
      for (const row of snapshot.enrollments) {
        try {
          await rpc("mienra_save_enrollment", {
            ...enrollmentRpcArgs(row),
            p_student_ref: studentReference(row.studentId)
          });
        }
        catch (error) { failures.push(`Inscription ${row.id}: ${rpcErrorMessage(error, "echec")}`); }
      }
      for (const row of [...snapshot.payments].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))) {
        try {
          await rpc("mienra_create_payment", {
            p_school_slug: SCHOOL_SLUG,
            p_year_name: row.year || currentYear(),
            p_student_ref: studentReference(row.studentId),
            p_legacy_id: row.id,
            p_amount: Number(row.amount),
            p_paid_by: row.paidBy || student(row.studentId)?.parent || "",
            p_mode: row.mode || "Especes",
            p_paid_on: row.date || today(),
            p_cashier: row.cashier || "",
            p_note: row.note || "Recupere depuis la copie locale",
            p_prefix: state.school.receiptPrefix || "REC"
          });
        } catch (error) {
          failures.push(`Paiement ${row.id}: ${rpcErrorMessage(error, "echec")}`);
        }
      }

      if (failures.length) {
        console.warn("Recuperation MIENRA incomplete:", failures);
        notify(`${failures.length} element(s) n'ont pas pu etre recuperes. La copie locale est conservee.`, "warn", 9000);
      } else {
        localStorage.removeItem(LOCAL_RECOVERY_KEY);
        localStorage.removeItem(LOCAL_RECOVERY_DISMISSED_KEY);
        notify("Donnees locales recuperees dans Supabase.", "success", 7000);
      }
    } catch (error) {
      console.warn("Controle des donnees locales:", error);
    }
  }

  pullSharedState = async function pullConfirmedServerState() {
    const forceRecovery = typeof location !== "undefined"
      && new URLSearchParams(location.search).get("recover") === "1";
    await recoverLocalOnlyData({ force: forceRecovery });
    return authoritativePull();
  };

  globalThis.mienraRecoverLocalData = async function forceLocalRecovery() {
    recoveryChecked = false;
    return recoverLocalOnlyData({ force: true });
  };

  // Les ecritures metier passent maintenant par des RPC unitaires. Une vieille
  // copie locale ne peut donc plus reecrire toute la base lors d'une actualisation.
  pushSharedState = async function confirmedWritesOnly() { return true; };

  async function refreshAuthoritativeState() {
    const ok = await pullSharedState();
    if (!ok) throw new Error("La relecture de Supabase a echoue.");
    saveLocalState();
  }

  function busyButton(active, fallback = "Enregistrement...") {
    const button = document.activeElement?.tagName === "BUTTON" ? document.activeElement : null;
    const label = button?.textContent || "";
    if (button && active) {
      button.disabled = true;
      button.textContent = fallback;
    }
    return () => {
      if (!button) return;
      button.disabled = false;
      button.textContent = label;
    };
  }

  saveStudent = async function saveStudentOnServer() {
    if (!requireAction("students") || writeSaving) return;
    if (!cloudReady()) return alert("Connexion Supabase requise. L'eleve n'a pas ete enregistre.");
    const name = $("stName")?.value.trim();
    if (!name) return alert("Le nom complet est obligatoire.");

    const existing = editing ? state.students.find((row) => row.id === editing) : null;
    const row = {
      id: existing?.id || uid("ELV"),
      matricule: existing?.matricule || "",
      name,
      gender: $("stGender")?.value || "M",
      birth: $("stBirth")?.value || "",
      entryDate: $("stEntryDate")?.value || $("stAddedDate")?.value || today(),
      addedDate: $("stAddedDate")?.value || today(),
      className: $("stClass")?.value || "",
      parent: $("stParent")?.value || "",
      phone: $("stPhone")?.value || "",
      address: $("stAddress")?.value || "",
      status: $("stStatus")?.value || "Actif"
    };
    if (!row.className) return alert("Selectionnez une classe.");

    const wasEditing = !!existing;
    const restoreButton = busyButton(true);
    let serverConfirmed = false;
    writeSaving = true;
    try {
      if (!existing) {
        row.matricule = await rpc("mienra_next_student_matricule", {
          p_school_slug: SCHOOL_SLUG,
          p_year_name: currentYear(),
          p_prefix: state.school.code || "EPVM"
        });
        if (!row.matricule) throw new Error("Supabase n'a pas retourne de matricule.");
      }
      await rpc("mienra_save_student", studentRpcArgs(row));
      serverConfirmed = true;
      editing = null;
      await refreshAuthoritativeState();
      pages.students();
      notify(`Eleve ${wasEditing ? "modifie" : "ajoute"} et confirme par Supabase.`, "success", 5000);
    } catch (error) {
      console.error("Enregistrement eleve:", error);
      if (serverConfirmed) {
        const index = state.students.findIndex((item) => item.id === row.id);
        if (index >= 0) state.students[index] = row;
        else state.students.push(row);
        editing = null;
        saveLocalState();
        pages.students();
        return notify("Eleve confirme dans Supabase. L'affichage se reactualisera automatiquement.", "warn", 7000);
      }
      alert(`Eleve non enregistre : ${rpcErrorMessage(error, "erreur Supabase")}`);
    } finally {
      writeSaving = false;
      restoreButton();
    }
  };

  saveEnrollment = async function saveEnrollmentOnServer() {
    if (!requireAction("enrollments") || writeSaving) return;
    if (editingEnrollment && !requireAction("deleteEnrollments")) return;
    if (!cloudReady()) return alert("Connexion Supabase requise. L'inscription n'a pas ete enregistree.");

    const row = {
      id: editingEnrollment || uid("INS"),
      studentId: $("enStudent")?.value || "",
      className: $("enClass")?.value || "",
      year: $("enYear")?.value || currentYear(),
      amount: Number($("enAmount")?.value || 0),
      discount: Number($("enDiscount")?.value || 0),
      date: $("enDate")?.value || today(),
      note: $("enNote")?.value || ""
    };
    const fee = classFee(state.classes, row.className);
    if (!row.studentId) return alert("Selectionnez un eleve.");
    if (fee <= 0) return alert("Aucun frais n'est defini pour cette classe.");
    if (!Number.isInteger(row.amount) || row.amount <= 0 || row.amount > fee) {
      return alert(`Le montant doit etre un entier positif inferieur ou egal aux frais de classe (${money(fee)}).`);
    }
    if (!Number.isInteger(row.discount) || row.discount < 0 || row.discount > row.amount) {
      return alert("La remise doit etre un entier compris entre zero et le montant.");
    }

    const wasEditing = !!editingEnrollment;
    const restoreButton = busyButton(true);
    let serverConfirmed = false;
    writeSaving = true;
    try {
      await rpc("mienra_save_enrollment", enrollmentRpcArgs(row));
      serverConfirmed = true;
      editingEnrollment = null;
      await refreshAuthoritativeState();
      showFinanceTab("tracking");
      notify(`Inscription ${wasEditing ? "modifiee" : "enregistree"} dans Supabase.`, "success", 5000);
    } catch (error) {
      console.error("Enregistrement inscription:", error);
      if (serverConfirmed) {
        const index = state.enrollments.findIndex((item) => item.id === row.id);
        if (index >= 0) state.enrollments[index] = row;
        else state.enrollments.push(row);
        editingEnrollment = null;
        saveLocalState();
        showFinanceTab("tracking");
        return notify("Inscription confirmee dans Supabase. L'affichage se reactualisera automatiquement.", "warn", 7000);
      }
      alert(`Inscription non enregistree : ${rpcErrorMessage(error, "erreur Supabase")}`);
    } finally {
      writeSaving = false;
      restoreButton();
    }
  };

  saveClass = async function saveClassOnServer() {
    if (!requireAction("classes") || writeSaving) return;
    if (!cloudReady()) return alert("Connexion Supabase requise. La classe n'a pas ete enregistree.");
    const name = $("className")?.value.trim();
    const fee = Number($("fee")?.value || 0);
    if (!name) return alert("La classe est obligatoire.");
    if (!Number.isInteger(fee) || fee < 0) return alert("Les frais doivent etre un montant entier positif.");
    const row = state.classes.find((item) => item.id === editing);
    const ref = row?.id || uid("CLS");
    const wasEditing = !!row;
    const restoreButton = busyButton(true);
    let serverConfirmed = false;
    writeSaving = true;
    try {
      await rpc("mienra_save_class", {
        p_school_slug: SCHOOL_SLUG,
        p_class_ref: ref,
        p_name: name,
        p_level: $("level")?.value || "Primaire",
        p_fee: fee
      });
      serverConfirmed = true;
      editing = null;
      await refreshAuthoritativeState();
      pages.classes();
      notify(`Classe ${wasEditing ? "modifiee" : "ajoutee"} dans Supabase.`, "success", 5000);
    } catch (error) {
      if (serverConfirmed) {
        const localRow = { id: ref, name, level: $("level")?.value || "Primaire", fee };
        const index = state.classes.findIndex((item) => item.id === ref);
        if (index >= 0) state.classes[index] = localRow;
        else state.classes.push(localRow);
        editing = null;
        saveLocalState();
        pages.classes();
        return notify("Classe confirmee dans Supabase. L'affichage se reactualisera automatiquement.", "warn", 7000);
      }
      alert(`Classe non enregistree : ${rpcErrorMessage(error, "erreur Supabase")}`);
    } finally {
      writeSaving = false;
      restoreButton();
    }
  };

  deleteClass = async function deleteClassOnServer(id) {
    if (!requireAction("classes")) return;
    if (!cloudReady()) return alert("Connexion Supabase requise.");
    if (!(await confirmDialog("Supprimer cette classe ?"))) return;
    try {
      await rpc("mienra_delete_class", { p_class_ref: id });
      await refreshAuthoritativeState();
      pages.classes();
      notify("Classe supprimee.", "success");
    } catch (error) {
      alert(`Classe non supprimee : ${rpcErrorMessage(error, "elle est peut-etre encore utilisee")}`);
    }
  };

  saveSettings = async function saveSettingsOnServer() {
    if (!requireAction("settings") || writeSaving) return;
    if (!cloudReady()) return alert("Connexion Supabase requise. Les parametres n'ont pas ete enregistres.");
    const name = $("schoolName")?.value.trim();
    const year = $("schoolYear")?.value.trim();
    if (!name || !year) return alert("Le nom de l'ecole et l'annee scolaire sont obligatoires.");
    const restoreButton = busyButton(true);
    let serverConfirmed = false;
    writeSaving = true;
    try {
      await rpc("mienra_save_school_settings", {
        p_school_slug: SCHOOL_SLUG,
        p_name: name,
        p_code: $("schoolCode")?.value.trim() || "EPVM",
        p_year_name: year,
        p_phone: $("schoolPhone")?.value || "",
        p_email: $("schoolEmail")?.value || "",
        p_address: $("schoolAddress")?.value || "",
        p_director: $("director")?.value || "",
        p_receipt_prefix: $("receiptPrefix")?.value || "REC",
        p_receipt_footer: $("receiptFooter")?.value || "Merci pour votre paiement."
      });
      serverConfirmed = true;
      await refreshAuthoritativeState();
      renderShell();
      notify("Parametres confirmes par Supabase.", "success", 5000);
    } catch (error) {
      if (serverConfirmed) {
        return notify("Parametres confirmes dans Supabase. L'affichage se reactualisera automatiquement.", "warn", 7000);
      }
      alert(`Parametres non enregistres : ${rpcErrorMessage(error, "erreur Supabase")}`);
    } finally {
      writeSaving = false;
      restoreButton();
    }
  };

  savePayment = async function savePaymentAtomically() {
    if (!requireAction("payments") || paymentSaving) return;
    if (!cloudReady()) {
      return alert("Connexion Supabase requise. Aucun paiement local ne sera cree.");
    }

    const studentId = $("payStudent")?.value;
    const appStudent = student(studentId);
    const amount = Number($("payAmount")?.value || 0);
    if (!studentId || !appStudent?.id) return alert("Selectionnez un eleve.");
    if (!Number.isInteger(amount) || amount <= 0) return alert("Saisissez un montant entier superieur a zero.");

    const currentBalance = balance(studentId);
    const expectedAtPayment = due(studentId);
    const paidBefore = paid(studentId);
    if (currentBalance <= 0) return alert("Cet eleve est deja solde pour cette annee scolaire.");
    if (amount > currentBalance) return alert(`Le montant depasse le reste a payer (${money(currentBalance)}).`);

    const button = document.activeElement?.tagName === "BUTTON" ? document.activeElement : null;
    const originalText = button?.textContent || "";
    const legacyId = uid("PAY");
    let created = null;
    paymentSaving = true;
    if (button) {
      button.disabled = true;
      button.textContent = "Enregistrement...";
    }

    try {
      const synced = await pushSharedState();
      if (!synced) throw new Error("L'eleve ou son inscription n'a pas pu etre synchronise.");

      const sb = getSupabase();
      const { data, error } = await sb.rpc("mienra_create_payment", {
        p_school_slug: SCHOOL_SLUG,
        p_year_name: currentYear(),
        p_student_ref: appStudent.id,
        p_legacy_id: legacyId,
        p_amount: amount,
        p_paid_by: $("paidBy")?.value.trim() || appStudent.parent || "",
        p_mode: $("payMode")?.value || "Espèces",
        p_paid_on: $("payDate")?.value || today(),
        p_cashier: $("cashier")?.value || session?.name || "",
        p_note: $("payNote")?.value || "",
        p_prefix: state.school.receiptPrefix || "REC"
      });
      if (error) throw error;
      created = Array.isArray(data) ? data[0] : data;
      if (!created?.receipt_no) throw new Error("Supabase n'a pas retourne le recu cree.");

      await refreshAuthoritativeState();
      activeReceipt = legacyId;
      view = "receipts";
      renderNav();
      receiptView();
      notify(`Paiement enregistre. Recu ${created.receipt_no}.`, "success", 5000);
    } catch (error) {
      console.error("Paiement atomique:", error);
      if (created?.receipt_no) {
        if (!state.payments.some((row) => row.id === legacyId)) {
          state.payments.push({
            id: legacyId,
            studentId,
            year: currentYear(),
            receiptNo: created.receipt_no,
            amount,
            expectedAtPayment,
            paidBefore,
            totalPaidAfter: paidBefore + amount,
            balanceAfter: Math.max(0, expectedAtPayment - paidBefore - amount),
            paidBy: $("paidBy")?.value.trim() || appStudent.parent || "",
            mode: $("payMode")?.value || "Especes",
            date: $("payDate")?.value || today(),
            cashier: $("cashier")?.value || session?.name || "",
            note: $("payNote")?.value || ""
          });
        }
        saveLocalState();
        activeReceipt = legacyId;
        view = "receipts";
        renderNav();
        receiptView();
        return notify(`Paiement confirme par Supabase. Recu ${created.receipt_no}.`, "warn", 8000);
      }
      alert(`Paiement non enregistre : ${rpcErrorMessage(error, "erreur Supabase")}`);
    } finally {
      paymentSaving = false;
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  };

  async function adminDeleteRpc(functionName, parameter, reference, confirmation) {
    if (session?.role !== "Administrateur") return alert("Action reservee a l'administrateur.");
    if (!cloudReady()) return alert("Connexion Supabase requise.");
    if (!(await confirmDialog(confirmation))) return false;
    const { error } = await getSupabase().rpc(functionName, { [parameter]: reference });
    if (error) {
      alert(`Suppression non appliquee : ${rpcErrorMessage(error, "erreur Supabase")}`);
      return false;
    }
    await refreshAuthoritativeState();
    return true;
  }

  deletePayment = async function deletePaymentOnServer(id) {
    if (!requireAction("deletePayments")) return;
    if (await adminDeleteRpc("mienra_delete_payment", "p_payment_ref", id, "Supprimer definitivement ce paiement ?")) {
      showFinanceTab("payments");
    }
  };

  deleteEnrollment = async function deleteEnrollmentOnServer(id) {
    if (!requireAction("deleteEnrollments")) return;
    if (await adminDeleteRpc("mienra_delete_enrollment", "p_enrollment_ref", id, "Supprimer definitivement cette inscription ?")) {
      showFinanceTab("tracking");
    }
  };

  deleteStudent = async function deleteStudentOnServer(id) {
    if (!requireAction("deleteStudents")) return;
    if (await adminDeleteRpc(
      "mienra_delete_student",
      "p_student_ref",
      id,
      "Supprimer definitivement cet eleve, ses inscriptions et ses paiements ?"
    )) {
      pages.students();
    }
  };

  window.toggleProductionMode = async function toggleSharedProductionMode() {
    if (session?.role !== "Administrateur") return alert("Action reservee a l'administrateur.");
    if (!cloudReady()) return alert("Connexion Supabase requise.");
    const next = !state.productionMode;
    const message = next
      ? "Activer le mode production ? Les actions dangereuses seront bloquees."
      : "Desactiver le mode production ? Les actions dangereuses redeviendront disponibles.";
    if (!(await confirmDialog(message, { danger: !next, okLabel: next ? "Activer" : "Desactiver" }))) return;
    const { error } = await getSupabase().from("schools")
      .update({ production_mode: next }).eq("slug", SCHOOL_SLUG);
    if (error) return alert(`Mode production non modifie : ${rpcErrorMessage(error, "erreur Supabase")}`);
    state.productionMode = next;
    saveLocalState();
    log(`Mode production ${next ? "active" : "desactive"}`, "Securite");
    await pushSharedState();
    pages.system();
  };

  downloadBackup = async function downloadAuthoritativeBackup() {
    if (!requireAction("backup")) return;
    if (!cloudReady()) return alert("Connexion Supabase requise pour exporter la base complete.");
    try {
      await refreshAuthoritativeState();
      const sb = getSupabase();
      const { data: school, error: schoolError } = await sb
        .from("schools").select("id").eq("slug", SCHOOL_SLUG).single();
      if (schoolError) throw schoolError;
      const { data: counters, error: counterError } = await sb
        .from("receipt_counters").select("school_year_id,last_number").eq("school_id", school.id);
      if (counterError) throw counterError;

      const stamp = new Date().toISOString().slice(0, 10);
      const exportedAt = new Date().toISOString();
      const payload = {
        app: "MIENRA Web",
        school: state.school?.name || SCHOOL_IDENTITY.name,
        version: ASSET_VERSION,
        exportedAt,
        source: "Supabase relationnel",
        receiptCounters: counters || [],
        data: normalizeState(state)
      };
      const serialized = JSON.stringify(payload, null, 2);
      recordBackup();
      log("Export sauvegarde Supabase complet", "Sauvegarde");
      await pushSharedState();
      download(`mienra-base-supabase-${stamp}.json`, serialized, "application/json");
      notify("Sauvegarde complete exportee.", "success", 4000);
    } catch (error) {
      alert(`Sauvegarde non exportee : ${rpcErrorMessage(error, "erreur Supabase")}`);
    }
  };

  studentActions = function studentActionsByRole(id) {
    const actions = [];
    if (canAction("students")) {
      actions.push(`<button class="btn quiet small" onclick="editStudent('${id}')">Modifier</button>`);
    }
    if (session?.role === "Administrateur" && canAction("deleteStudents")) {
      actions.push(`<button class="btn danger small" onclick="deleteStudent('${id}')">Supprimer</button>`);
    }
    return actions.length ? actions.join(" ") : `<span class="muted">Lecture seule</span>`;
  };

  syncNow = async function syncFromSupabaseNow() {
    if (!cloudReady()) return alert("Connexion Supabase requise.");
    try {
      await refreshAuthoritativeState();
      renderShell();
      notify("Donnees actualisees depuis Supabase.", "success", 4000);
    } catch (error) {
      alert(`Synchronisation impossible : ${rpcErrorMessage(error, "erreur Supabase")}`);
    }
  };

  function stateSignature() {
    return JSON.stringify({
      year: currentYear(),
      classes: state.classes.map((row) => [row.id, row.name, row.fee]),
      students: state.students.map((row) => [row.id, row.name, row.className, row.status]),
      enrollments: state.enrollments.map((row) => [row.id, row.amount, row.discount, row.date]),
      payments: state.payments.map((row) => [row.id, row.receiptNo, row.amount, row.date])
    });
  }

  function canRefreshVisiblePage() {
    if (document.visibilityState === "hidden" || writeSaving || paymentSaving) return false;
    if (editing || editingEnrollment || document.querySelector(".modal-overlay, .receipt-page")) return false;
    const tag = document.activeElement?.tagName;
    return !["INPUT", "SELECT", "TEXTAREA"].includes(tag);
  }

  function captureFormValues() {
    const values = {};
    document.querySelectorAll("input[id], select[id], textarea[id]").forEach((field) => {
      if (field.type !== "file") values[field.id] = field.value;
    });
    return values;
  }

  function restoreFormValues(values) {
    Object.entries(values).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field && field.type !== "file") field.value = value;
    });
  }

  async function autoRefreshFromSupabase() {
    if (autoRefreshRunning || !cloudReady() || !canRefreshVisiblePage()) return;
    autoRefreshRunning = true;
    const before = stateSignature();
    const formValues = captureFormValues();
    try {
      const ok = await pullSharedState();
      if (!ok) return;
      const changed = before !== stateSignature();
      if (!changed) return;
      renderShell();
      restoreFormValues(formValues);
      notify("Nouvelles donnees recues de Supabase.", "info", 4000);
    } catch (error) {
      console.warn("Actualisation automatique:", error);
    } finally {
      autoRefreshRunning = false;
    }
  }

  window.addEventListener("focus", () => setTimeout(autoRefreshFromSupabase, 300));
  window.addEventListener("online", () => setTimeout(autoRefreshFromSupabase, 300));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(autoRefreshFromSupabase, 300);
  });
  setInterval(autoRefreshFromSupabase, 15000);

  globalThis.mienraRefreshFromSupabase = autoRefreshFromSupabase;

  try {
    localStorage.removeItem("mienra_pending_payments_v1");
    localStorage.setItem("mienra_relational_mode", "on");
  } catch (_) {}
})();
