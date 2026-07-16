-- =============================================================================
-- Politiques RLS pour la table de secours JSON `mienra_app_state`
-- =============================================================================
-- Contexte : l'application écrit ses données à la fois dans les tables
-- relationnelles ET dans le bloc JSON `mienra_app_state` (filet de sécurité de
-- transition). Cette table avait le RLS activé SANS aucune politique : elle
-- était donc totalement inaccessible aux utilisateurs connectés, ce qui cassait
-- silencieusement le filet de secours JSON (le relationnel, lui, continuait de
-- fonctionner).
--
-- Ces politiques restaurent l'accès avec une sécurité COHÉRENTE avec le reste
-- de l'application MIENRA :
--   * Lecture  : tout utilisateur authentifié disposant d'un profil actif
--                (tous les rôles, y compris Consultation).
--   * Écriture : uniquement les rôles gestionnaires
--                (Administrateur, Directeur, Secrétaire), via
--                public.can_manage_school_data().
--
-- Idempotent : peut être ré-exécuté sans erreur.
-- Réversible : supprimer les trois politiques ci-dessous rétablit l'état initial
--              (table verrouillée). Le mode relationnel reste inchangé.
-- =============================================================================

drop policy if exists "app_state_select_authenticated" on public.mienra_app_state;
drop policy if exists "app_state_insert_managers" on public.mienra_app_state;
drop policy if exists "app_state_update_managers" on public.mienra_app_state;

create policy "app_state_select_authenticated"
  on public.mienra_app_state
  for select
  to authenticated
  using (public.current_profile_role() is not null);

create policy "app_state_insert_managers"
  on public.mienra_app_state
  for insert
  to authenticated
  with check (public.can_manage_school_data());

create policy "app_state_update_managers"
  on public.mienra_app_state
  for update
  to authenticated
  using (public.can_manage_school_data())
  with check (public.can_manage_school_data());
