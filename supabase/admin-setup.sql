-- =====================================================================
-- MIENRA Web — Mise en place SÉCURISÉE, priorité au compte ADMIN
--
-- Le compte administrateur est le plus important : c'est lui qui donne
-- (ou retire) les accès aux autres utilisateurs. Ce script se concentre
-- donc sur l'admin d'abord. Une fois l'admin en place et connecté, vous
-- pourrez ajouter les autres comptes de la même façon.
--
-- À exécuter dans : Supabase → SQL Editor.
--
-- ⚠️ ORDRE OBLIGATOIRE (sinon vous risquez de vous verrouiller dehors) :
--   1) Créez d'abord le compte admin dans Authentication → Users
--      (bouton « Add user », cochez « Auto Confirm User »).
--   2) Remplacez ci-dessous 'admin@mienra.app' par l'e-mail EXACT que
--      vous avez utilisé à l'étape 1 (gardez les guillemets simples).
--   3) Exécutez tout ce script d'un seul coup.
-- =====================================================================

-- Nécessaire pour certaines fonctions (sans risque si déjà présent).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Paramètre : l'e-mail de VOTRE compte admin (créé à l'étape 1 ci-dessus).
-- ⬇️  MODIFIEZ CETTE SEULE LIGNE si vous n'utilisez pas admin@mienra.app.
-- ---------------------------------------------------------------------
-- (On l'utilise plus bas via un bloc PL/pgSQL pour retrouver son UUID.)

-- ---------------------------------------------------------------------
-- 1) Table de l'état partagé de l'établissement (une ligne par école).
-- ---------------------------------------------------------------------
create table if not exists public.mienra_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.mienra_app_state enable row level security;

-- On retire les anciennes politiques ouvertes à « anon » (accès public
-- lecture/écriture) : c'est justement le trou de sécurité à fermer.
drop policy if exists "MIENRA shared app state read" on public.mienra_app_state;
drop policy if exists "MIENRA shared app state write" on public.mienra_app_state;

-- Politiques sécurisées : réservées aux utilisateurs AUTHENTIFIÉS.
drop policy if exists "État lisible par les utilisateurs authentifiés" on public.mienra_app_state;
create policy "État lisible par les utilisateurs authentifiés"
  on public.mienra_app_state
  for select
  to authenticated
  using (true);

drop policy if exists "État modifiable par les utilisateurs authentifiés" on public.mienra_app_state;
create policy "État modifiable par les utilisateurs authentifiés"
  on public.mienra_app_state
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- 2) Table des profils : rôle applicatif de chaque compte Supabase Auth.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id   uuid primary key references auth.users (id) on delete cascade,
  name text,
  role text not null default 'Consultation'
);

alter table public.profiles enable row level security;

-- Chaque utilisateur ne peut lire que SON propre profil (donc son rôle).
drop policy if exists "Lecture de son propre profil" on public.profiles;
create policy "Lecture de son propre profil"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 3) Créer/mettre à jour le PROFIL ADMIN en retrouvant son UUID par e-mail.
--    Aucun UUID à copier-coller : on va le chercher dans auth.users.
-- ---------------------------------------------------------------------
do $$
declare
  admin_email text := 'admin@mienra.app';   -- ⬅️  votre e-mail admin
  admin_id    uuid;
begin
  select id into admin_id
  from auth.users
  where lower(email) = lower(admin_email);

  if admin_id is null then
    raise exception
      'Compte admin introuvable pour l''e-mail « % ». Créez-le d''abord dans Authentication → Users (Add user, Auto Confirm), puis réexécutez ce script.',
      admin_email;
  end if;

  insert into public.profiles (id, name, role)
  values (admin_id, 'Administrateur', 'Administrateur')
  on conflict (id) do update
    set name = excluded.name,
        role = excluded.role;

  raise notice 'Profil administrateur prêt pour % (UUID %).', admin_email, admin_id;
end $$;

-- ---------------------------------------------------------------------
-- 4) Vérification : doit afficher une ligne « Administrateur ».
-- ---------------------------------------------------------------------
select u.email, p.name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'Administrateur';

-- =====================================================================
-- ✅ Terminé. Rechargez https://patrickeudess.github.io/mienra/ et
--    connectez-vous avec l'identifiant « admin » (ou l'e-mail complet)
--    et le mot de passe défini à l'étape 1. La mention « Mode données »
--    passe à « Données partagées » : l'accès anonyme est fermé.
--
--    Pour AJOUTER un autre utilisateur plus tard :
--    - créez son compte dans Authentication → Users ;
--    - relancez un bloc identique au point 3 avec son e-mail et le rôle
--      voulu ('Directeur', 'Secrétaire' ou 'Consultation').
-- =====================================================================
