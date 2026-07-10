// =====================================================================
// MIENRA — Fonction serveur « admin-users »
//
// Permet à l'ADMINISTRATEUR (et à lui seul) de créer / supprimer / changer
// le mot de passe des comptes de connexion depuis l'application, sans jamais
// exposer la clé « maître » dans la page web.
//
// La clé service_role est disponible automatiquement dans l'environnement de
// la fonction (SUPABASE_SERVICE_ROLE_KEY) : elle ne quitte JAMAIS le serveur.
//
// Déploiement : voir docs/creer-comptes-depuis-app.md
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Identifier l'appelant à partir de son jeton (JWT).
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Non authentifié" }, 401);
    const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !caller?.user) return json({ error: "Non authentifié" }, 401);

    // 2) Vérifier que l'appelant est bien Administrateur (table profiles).
    const { data: prof } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .single();
    if (prof?.role !== "Administrateur") {
      return json({ error: "Action réservée à l'administrateur." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const email = body.email ? String(body.email).toLowerCase().trim() : "";
    const password = body.password ? String(body.password) : "";

    // Utilitaire : retrouver un compte par e-mail.
    const findByEmail = async (mail: string) => {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      return data.users.find((u) => (u.email || "").toLowerCase() === mail) || null;
    };

    if (action === "create") {
      if (!email || !password) return json({ error: "E-mail et mot de passe requis." }, 400);
      if (password.length < 6) return json({ error: "Le mot de passe doit faire au moins 6 caractères." }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data.user?.id });
    }

    if (action === "set-password") {
      if (!email || !password) return json({ error: "E-mail et mot de passe requis." }, 400);
      const target = await findByEmail(email);
      if (!target) return json({ error: "Compte de connexion introuvable." }, 404);
      const { error } = await admin.auth.admin.updateUserById(target.id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      if (!email) return json({ error: "E-mail requis." }, 400);
      const target = await findByEmail(email);
      if (!target) return json({ ok: true }); // déjà absent : rien à faire
      if (target.id === caller.user.id) {
        return json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(target.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message || "Erreur serveur." }, 500);
  }
});
