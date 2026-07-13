// MIENRA Web - Adaptateur Supabase relationnel
// Charge apres app-pro.js. Il remplace progressivement la synchronisation
// JSON par une lecture/ecriture dans les tables relationnelles Supabase.

(() => {
  const RELATIONAL_MODE_KEY = "mienra_relational_mode";
  const SCHOOL_SLUG = "epv-mienrassou";
  const SCHOOL_FALLBACK_ID = "epp-mienrassou";

  if (typeof getSupabase !== "function") return;

  const originalPullSharedState = pullSharedState;
  const originalPushSharedState = pushSharedState;
  const originalSyncLabel = syncLabel;

  let relationalReadyCache = null;
  let relationalSyncing = false;
  let relationalLastError = "";

  function relationModeEnabled() {
    return localStorage.getItem(RELATIONAL_MODE_KEY) === "on";
  }

  function setRelationMode(value) {
    localStorage.setItem(RELATIONAL_MODE_KEY, value ? "on" : "off");
  }

  function sbClient() {
    if (!supabaseAuthAvailable() || !authSession) return null;
    return getSupabase();
  }

  async function fetchSchool(sb) {
    const { data, error } = await sb.from("schools").select("*").eq("slug", SCHOOL_SLUG).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function relationTablesReady({ requireData = false } = {}) {
    const sb = sbClient();
    if (!sb) return false;
    if (relationalReadyCache && !requireData) return true;
    try {
      const school = await fetchSchool(sb);
      if (!school?.id) return false;
      if (requireData) {
        const { count, error } = await sb
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id);
        if (error) throw error;
        if (!count && state.students.length > 0 && !relationModeEnabled()) return false;
      }
      relationalReadyCache = { schoolId: school.id, school };
      return true;
    } catch (error) {
      relationalLastError = error.message || "Tables relationnelles indisponibles";
      console.warn("MIENRA relationnel indisponible:", relationalLastError);
      return false;
    }
  }

  function asDate(value) {
    return value ? String(value).slice(0, 10) : null;
  }

  function buildSchoolState(row) {
    return {
      name: row?.name || SCHOOL_IDENTITY.name,
      code: row?.code || SCHOOL_IDENTITY.code,
      year: currentYear(),
      phone: row?.phone || SCHOOL_IDENTITY.phone,
      email: row?.email || "",
      address: row?.address || SCHOOL_IDENTITY.location,
      director: row?.director || SCHOOL_IDENTITY.director,
      logo: "M",
      logoImage: LOGO_SRC,
      receiptPrefix: row?.receipt_prefix || "REC",
      receiptFooter: row?.receipt_footer || "Merci pour votre paiement."
    };
  }

  function toAppState({ school, years, classes, students, enrollments, payments, logs }) {
    const classByUuid = new Map((classes || []).map((row) => [row.id, row]));
    const classAppIdByUuid = new Map((classes || []).map((row) => [row.id, row.legacy_id || row.id]));
    const studentAppIdByUuid = new Map((students || []).map((row) => [row.id, row.legacy_id || row.id]));
    const yearByUuid = new Map((years || []).map((row) => [row.id, row]));
    const activeYear = years.find((row) => row.is_active)?.name || state.activeYear || state.school.year;

    return normalizeState({
      ...state,
      school: { ...state.school, ...buildSchoolState(school), year: activeYear },
      years: years.length ? years.map((row) => row.name) : state.years,
      activeYear,
      classes: classes.map((row) => ({
        id: row.legacy_id || row.id,
        name: row.name,
        level: row.level,
        fee: Number(row.fee || 0)
      })),
      students: students.map((row) => {
        const cls = classByUuid.get(row.class_id);
        return {
          id: row.legacy_id || row.id,
          matricule: row.matricule,
          name: row.name,
          gender: row.gender || "",
          birth: asDate(row.birth),
          entryDate: asDate(row.entry_date),
          addedDate: asDate(row.added_date) || today(),
          className: cls?.name || "",
          parent: row.parent_name || "",
          phone: row.phone || "",
          address: row.address || "",
          status: row.status || "Actif"
        };
      }),
      enrollments: enrollments.map((row) => ({
        id: row.legacy_id || row.id,
        studentId: studentAppIdByUuid.get(row.student_id) || row.student_id,
        className: classByUuid.get(row.class_id)?.name || "",
        classId: classAppIdByUuid.get(row.class_id) || row.class_id,
        year: yearByUuid.get(row.school_year_id)?.name || activeYear,
        amount: Number(row.amount || 0),
        discount: Number(row.discount || 0),
        date: asDate(row.enrolled_on) || today(),
        note: row.note || ""
      })),
      payments: payments.map((row) => ({
        id: row.legacy_id || row.id,
        studentId: studentAppIdByUuid.get(row.student_id) || row.student_id,
        year: yearByUuid.get(row.school_year_id)?.name || activeYear,
        receiptNo: row.receipt_no,
        amount: Number(row.amount || 0),
        expectedAtPayment: Number(row.expected_at_payment || 0),
        paidBefore: Number(row.paid_before || 0),
        totalPaidAfter: Number(row.total_paid_after || 0),
        balanceAfter: Number(row.balance_after || 0),
        paidBy: row.paid_by || "",
        mode: row.mode || "Espèces",
        date: asDate(row.paid_on) || today(),
        cashier: row.cashier || "",
        note: row.note || ""
      })),
      logs: logs.map((row) => ({
        id: row.legacy_id || row.id,
        iso: row.created_at || new Date().toISOString(),
        date: new Date(row.created_at || Date.now()).toLocaleString("fr-FR"),
        user: row.user_name || "Système",
        role: row.role || "",
        type: row.type || "Action",
        action: row.action || "",
        device: row.device || "",
        detail: row.detail || ""
      }))
    });
  }

  async function pullRelationalState() {
    const sb = sbClient();
    if (!sb || !(await relationTablesReady({ requireData: true }))) return false;
    const school = relationalReadyCache.school || await fetchSchool(sb);
    const schoolId = school.id;
    const [yearsRes, classesRes, studentsRes, enrollmentsRes, paymentsRes, logsRes] = await Promise.all([
      sb.from("school_years").select("*").eq("school_id", schoolId).order("name"),
      sb.from("classes").select("*").eq("school_id", schoolId).order("name"),
      sb.from("students").select("*").eq("school_id", schoolId).order("name"),
      sb.from("enrollments").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      sb.from("payments").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      sb.from("app_logs").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500)
    ]);

    const firstError = [yearsRes, classesRes, studentsRes, enrollmentsRes, paymentsRes, logsRes].find((res) => res.error)?.error;
    if (firstError) throw firstError;

    state = toAppState({
      school,
      years: yearsRes.data || [],
      classes: classesRes.data || [],
      students: studentsRes.data || [],
      enrollments: enrollmentsRes.data || [],
      payments: paymentsRes.data || [],
      logs: logsRes.data || []
    });
    saveLocalState();
    setRelationMode(true);
    relationalLastError = "";
    return true;
  }

  async function ensureBaseRows(sb) {
    let school = await fetchSchool(sb);
    if (!school) {
      const { data, error } = await sb.from("schools").insert({
        slug: SCHOOL_SLUG,
        name: state.school.name || SCHOOL_IDENTITY.name,
        code: state.school.code || SCHOOL_IDENTITY.code,
        phone: state.school.phone || SCHOOL_IDENTITY.phone,
        email: state.school.email || null,
        address: state.school.address || SCHOOL_IDENTITY.location,
        director: state.school.director || SCHOOL_IDENTITY.director,
        receipt_prefix: state.school.receiptPrefix || "REC",
        receipt_footer: state.school.receiptFooter || "Merci pour votre paiement."
      }).select("*").single();
      if (error) throw error;
      school = data;
    }
    relationalReadyCache = { schoolId: school.id, school };
    return school;
  }

  async function pushRelationalState() {
    const sb = sbClient();
    if (!sb || relationalSyncing) return false;
    if (!(await relationTablesReady())) return false;

    relationalSyncing = true;
    try {
      const school = await ensureBaseRows(sb);
      const schoolId = school.id;
      const activeYear = currentYear();

      await sb.from("schools").update({
        name: state.school.name || SCHOOL_IDENTITY.name,
        code: state.school.code || SCHOOL_IDENTITY.code,
        phone: state.school.phone || null,
        email: state.school.email || null,
        address: state.school.address || null,
        director: state.school.director || null,
        receipt_prefix: state.school.receiptPrefix || "REC",
        receipt_footer: state.school.receiptFooter || "Merci pour votre paiement."
      }).eq("id", schoolId);

      const yearRows = [...new Set([...(state.years || []), activeYear])].filter(Boolean).map((name) => ({
        school_id: schoolId,
        name,
        is_active: name === activeYear
      }));
      if (yearRows.length) {
        const { error } = await sb.from("school_years").upsert(yearRows, { onConflict: "school_id,name" });
        if (error) throw error;
      }

      const { data: yearData, error: yearError } = await sb.from("school_years").select("id,name").eq("school_id", schoolId);
      if (yearError) throw yearError;
      const yearIdByName = new Map((yearData || []).map((row) => [row.name, row.id]));

      const classRows = state.classes.map((row) => ({
        school_id: schoolId,
        legacy_id: row.id,
        name: row.name,
        level: row.level || "Primaire",
        fee: Number(row.fee || 0)
      }));
      if (classRows.length) {
        const { error } = await sb.from("classes").upsert(classRows, { onConflict: "school_id,name" });
        if (error) throw error;
      }
      const { data: classData, error: classError } = await sb.from("classes").select("id,name,legacy_id").eq("school_id", schoolId);
      if (classError) throw classError;
      const classByName = new Map((classData || []).map((row) => [row.name, row]));

      const studentRows = state.students.map((row) => ({
        school_id: schoolId,
        legacy_id: row.id,
        matricule: row.matricule,
        name: row.name,
        gender: row.gender || null,
        birth: row.birth || null,
        entry_date: row.entryDate || null,
        added_date: row.addedDate || today(),
        class_id: classByName.get(row.className)?.id || null,
        parent_name: row.parent || row.parentName || null,
        phone: row.phone || row.contact || null,
        address: row.address || null,
        status: row.status || "Actif"
      })).filter((row) => row.matricule && row.name);
      if (studentRows.length) {
        const { error } = await sb.from("students").upsert(studentRows, { onConflict: "school_id,matricule" });
        if (error) throw error;
      }
      const { data: studentData, error: studentError } = await sb.from("students").select("id,legacy_id,matricule").eq("school_id", schoolId);
      if (studentError) throw studentError;
      const studentByAppId = new Map();
      (studentData || []).forEach((row) => {
        if (row.legacy_id) studentByAppId.set(row.legacy_id, row.id);
        if (row.matricule) {
          const app = state.students.find((s) => s.matricule === row.matricule);
          if (app?.id) studentByAppId.set(app.id, row.id);
        }
      });

      const enrollmentRows = state.enrollments.map((row) => {
        const studentId = studentByAppId.get(row.studentId);
        const classId = classByName.get(row.className)?.id;
        const yearId = yearIdByName.get(row.year || activeYear);
        if (!studentId || !classId || !yearId) return null;
        return {
          school_id: schoolId,
          legacy_id: row.id,
          student_id: studentId,
          school_year_id: yearId,
          class_id: classId,
          amount: Number(row.amount || 0),
          discount: Number(row.discount || 0),
          enrolled_on: row.date || today(),
          note: row.note || null,
          created_by: authSession?.user?.id || null
        };
      }).filter(Boolean);
      if (enrollmentRows.length) {
        const { error } = await sb.from("enrollments").upsert(enrollmentRows, { onConflict: "student_id,school_year_id" });
        if (error) throw error;
      }

      const paymentRows = state.payments.map((row) => {
        const studentId = studentByAppId.get(row.studentId);
        const yearId = yearIdByName.get(row.year || activeYear);
        if (!studentId || !yearId) return null;
        return {
          school_id: schoolId,
          legacy_id: row.id,
          student_id: studentId,
          school_year_id: yearId,
          receipt_no: row.receiptNo || row.number || row.id,
          amount: Number(row.amount || 0),
          expected_at_payment: Number(row.expectedAtPayment || 0),
          paid_before: Number(row.paidBefore || 0),
          total_paid_after: Number(row.totalPaidAfter || 0),
          balance_after: Number(row.balanceAfter || 0),
          paid_by: row.paidBy || null,
          mode: row.mode || "Espèces",
          paid_on: row.date || today(),
          cashier: row.cashier || null,
          note: row.note || null,
          created_by: authSession?.user?.id || null
        };
      }).filter((row) => row && row.amount > 0);
      if (paymentRows.length) {
        const { error } = await sb.from("payments").upsert(paymentRows, { onConflict: "school_id,receipt_no" });
        if (error) throw error;
      }

      const logRows = (state.logs || []).slice(0, 100).map((row) => ({
        school_id: schoolId,
        legacy_id: row.id,
        user_id: authSession?.user?.id || null,
        user_name: row.user || null,
        role: row.role || null,
        type: row.type || null,
        action: row.action || "Operation",
        detail: row.detail || null,
        device: row.device || null,
        created_at: row.iso || new Date().toISOString()
      }));
      if (logRows.length) await sb.from("app_logs").insert(logRows).throwOnError?.();

      setRelationMode(true);
      relationalLastError = "";
      return true;
    } catch (error) {
      relationalLastError = error.message || "Synchronisation relationnelle impossible";
      console.warn("MIENRA relationnel:", relationalLastError);
      return false;
    } finally {
      relationalSyncing = false;
    }
  }

  pullSharedState = async function pullSharedStateRelationalFirst() {
    try {
      if (await pullRelationalState()) return true;
    } catch (error) {
      relationalLastError = error.message || "Lecture relationnelle impossible";
      console.warn("MIENRA relationnel:", relationalLastError);
    }
    return originalPullSharedState();
  };

  pushSharedState = async function pushSharedStateRelationalFirst() {
    if (await pushRelationalState()) {
      // On garde aussi l'ancien bloc JSON comme sauvegarde lisible pendant la transition.
      originalPushSharedState();
      return true;
    }
    return originalPushSharedState();
  };

  syncLabel = function syncLabelWithRelationalMode() {
    if (relationModeEnabled()) return relationalLastError ? "Relationnel à vérifier" : "Données relationnelles";
    return originalSyncLabel();
  };

  window.mienraRelationnel = {
    async activer() {
      setRelationMode(true);
      await pushRelationalState();
      await pullRelationalState();
      if (typeof renderShell === "function" && session) renderShell();
      return relationModeEnabled();
    },
    async etat() {
      return {
        actif: relationModeEnabled(),
        pret: await relationTablesReady(),
        erreur: relationalLastError || ""
      };
    },
    desactiver() {
      setRelationMode(false);
      if (typeof renderShell === "function" && session) renderShell();
    }
  };
})();
