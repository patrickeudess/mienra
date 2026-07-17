// MIENRA Web - synchronisation temps reel et restauration de session.

(() => {
  const SCHOOL_SLUG = "epv-mienrassou";
  const REALTIME_TABLES = [
    "schools",
    "school_years",
    "classes",
    "students",
    "enrollments",
    "payments",
    "app_logs"
  ];

  let realtimeChannel = null;
  let realtimeTimer = null;
  let sessionRestoreRunning = false;

  function cloudSessionReady() {
    return typeof getSupabase === "function"
      && typeof supabaseAuthAvailable === "function"
      && supabaseAuthAvailable()
      && !!authSession;
  }

  function scheduleRefresh() {
    clearTimeout(realtimeTimer);
    realtimeTimer = setTimeout(() => {
      if (typeof globalThis.mienraRefreshFromSupabase === "function") {
        globalThis.mienraRefreshFromSupabase();
      }
    }, 250);
  }

  function stopRealtimeSync() {
    clearTimeout(realtimeTimer);
    realtimeTimer = null;
    if (!realtimeChannel || typeof getSupabase !== "function") return;
    getSupabase().removeChannel(realtimeChannel).catch(() => {});
    realtimeChannel = null;
  }

  function startRealtimeSync() {
    if (!cloudSessionReady() || realtimeChannel) return;
    const sb = getSupabase();
    let channel = sb.channel(`mienra-live-${SCHOOL_SLUG}`);
    REALTIME_TABLES.forEach((table) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh
      );
    });
    realtimeChannel = channel.subscribe((status) => {
      if (status === "SUBSCRIBED") scheduleRefresh();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("MIENRA Realtime indisponible, actualisation periodique conservee.");
      }
    });
  }

  async function restoreSupabaseSession() {
    if (sessionRestoreRunning || session || !supabaseAuthAvailable()) return;
    sessionRestoreRunning = true;
    try {
      const sb = getSupabase();
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError || !sessionData?.session) return;

      const { data: userData, error: userError } = await sb.auth.getUser();
      if (userError || !userData?.user) return;

      const profile = await loadProfile(userData.user.id);
      if (!profile?.role) {
        await sb.auth.signOut().catch(() => {});
        return;
      }

      authSession = sessionData.session;
      await pullSharedState();
      const email = String(userData.user.email || "").toLowerCase();
      const appUser = state.users.find((item) => (
        authEmail(item.login).toLowerCase() === email
        || String(item.email || "").toLowerCase() === email
      ));
      session = {
        id: userData.user.id,
        login: appUser?.login || email.split("@")[0] || "utilisateur",
        name: profile.name || appUser?.name || email.split("@")[0] || "Utilisateur",
        role: profile.role,
        active: true
      };
      log("Session restauree", "Connexion");
      renderShell();
    } catch (error) {
      console.warn("Restauration de session MIENRA:", error?.message || error);
    } finally {
      sessionRestoreRunning = false;
    }
  }

  const renderShellBeforeRealtime = renderShell;
  renderShell = function renderShellWithRealtime() {
    const result = renderShellBeforeRealtime.apply(this, arguments);
    startRealtimeSync();
    return result;
  };

  const logoutBeforeRealtime = logout;
  logout = function logoutWithRealtimeCleanup() {
    stopRealtimeSync();
    return logoutBeforeRealtime.apply(this, arguments);
  };

  const logBeforeServerAudit = log;
  log = function logWithServerAudit(action, type = "Action", detail = "") {
    const result = logBeforeServerAudit.apply(this, arguments);
    if (cloudSessionReady()) {
      getSupabase().rpc("mienra_log_event", {
        p_action: String(action || "Operation"),
        p_type: String(type || "Action"),
        p_detail: String(detail || ""),
        p_device: typeof deviceId === "function" ? deviceId() : "Navigateur"
      }).then(({ error }) => {
        if (error) console.warn("Journal Supabase:", error.message || error);
      }).catch(() => {});
    }
    return result;
  };

  window.addEventListener("load", restoreSupabaseSession);
  globalThis.mienraRealtime = {
    demarrer: startRealtimeSync,
    arreter: stopRealtimeSync,
    actualiser: scheduleRefresh
  };
})();
