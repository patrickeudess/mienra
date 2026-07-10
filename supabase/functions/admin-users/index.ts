// =====================================================================
// MIENRA — Fonction serveur « admin-users »
//
// Seul un ADMINISTRATEUR peut créer / mettre à jour / (dé)verrouiller /
// supprimer les comptes de connexion, depuis l'application, sans jamais
// exposer la clé « maître » (service_role) dans la page web.
//
// IMPORTANT (sécurité) : le RÔLE de chaque utilisateur est écrit ici, dans la
// table `profiles` (côté serveur). Le client ne peut PAS écrire `profiles`
// (RLS), donc personne ne peut s'octroyer un rôle en modifiant les données
// partagées. C'est la connexion qui lit le rôle depuis `profiles`.
//
// Déploiement : voir docs/creer-comptes-depuis-app.md
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["Administrateur", "Directeur", "Secrétaire", "Consultation"];

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

    // 1) Identifier l'appelant via son jeton.
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Non authentifié" }, 401);
    const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !caller?.user) return json({ error: "Non authentifié" }, 401);

    // 2) Vérifier qu'il est Administrateur.
    const { data: prof } = await admin
      .from("profiles").select("role").eq("id", caller.user.id).single();
    if (prof?.role !== "Administrateur") {
      return json({ error: "Action réservée à l'administrateur." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const email = body.email ? String(body.email).toLowerCase().trim() : "";
    const password = body.password ? String(body.password) : "";
    const name = body.name != null ? String(body.name) : null;
    const role = body.role != null ? String(body.role) : null;
    const active = body.active;

    if (role != null && !ROLES.includes(role)) {
      return json({ error: "Rôle invalide." }, 400);
    }

    const findByEmail = async (mail: string) => {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      return data.users.find((u) => (u.email || "").toLowerCase() === mail) || null;
    };
    const upsertProfile = async (id: string) => {
      const row: Record<string, unknown> = { id };
      if (name != null) row.name = name;
      if (role != null) row.role = role;
      const { error } = await admin.from("profiles").upsert(row);
      if (error) throw new Error(error.message);
    };

    if (action === "create") {
      if (!email || !password) return json({ error: "E-mail et mot de passe requis." }, 400);
      if (password.length < 6) return json({ error: "Le mot de passe doit faire au moins 6 caractères." }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      if (data.user) await upsertProfile(data.user.id);
      return json({ ok: true, id: data.user?.id });
    }

    if (action === "update") {
      if (!email) return json({ error: "E-mail requis." }, 400);
      const target = await findByEmail(email);
      if (!target) return json({ error: "Compte de connexion introuvable." }, 404);
      if (password) {
        if (password.length < 6) return json({ error: "Le mot de passe doit faire au moins 6 caractères." }, 400);
        const { error } = await admin.auth.admin.updateUserById(target.id, { password });
        if (error) return json({ error: error.message }, 400);
      }
      await upsertProfile(target.id);
      return json({ ok: true });
    }

    if (action === "set-active") {
      if (!email) return json({ error: "E-mail requis." }, 400);
      const target = await findByEmail(email);
      if (!target) return json({ error: "Compte de connexion introuvable." }, 404);
      if (target.id === caller.user.id && active === false) {
        return json({ error: "Vous ne pouvez pas verrouiller votre propre compte." }, 400);
      }
      // Bannir = bloquer réellement la connexion ; « none » = réactiver.
      const { error } = await admin.auth.admin.updateUserById(target.id, {
        ban_duration: active === false ? "876000h" : "none",
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      if (!email) return json({ error: "E-mail requis." }, 400);
      const target = await findByEmail(email);
      if (!target) return json({ ok: true }); // déjà absent (profiles suit via cascade)
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
