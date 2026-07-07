-- =====================================================================
-- MIENRA Web — Schéma Supabase SÉCURISÉ (authentification requise)
--
-- Objectif : seules les personnes AUTHENTIFIÉES via Supabase Auth peuvent
-- lire et écrire les données de l'école. La clé « anon » publique, à elle
-- seule, ne donne plus aucun accès aux données.
--
-- À exécuter dans : Supabase → SQL Editor.
-- IMPORTANT : lisez d'abord docs/securite-supabase.md pour l'ordre des
-- opérations (créer les comptes AVANT de durcir la RLS, sinon coupure).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) État partagé de l'établissement (une ligne par école).
-- ---------------------------------------------------------------------
create table if not exists public.mienra_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.mienra_app_state enable row level security;

-- Supprime les anciennes politiques ouvertes à « anon » (accès public).
drop policy if exists "MIENRA shared app state read" on public.mienra_app_state;
drop policy if exists "MIENRA shared app state write" on public.mienra_app_state;

-- Nouvelles politiques : réservées aux utilisateurs authentifiés.
create policy "État lisible par les utilisateurs authentifiés"
  on public.mienra_app_state
  for select
  to authenticated
  using (true);

create policy "État modifiable par les utilisateurs authentifiés"
  on public.mienra_app_state
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- 2) Profils : rôle applicatif de chaque compte Supabase Auth.
--    (Administrateur, Directeur, Secrétaire, Consultation)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id   uuid primary key references auth.users (id) on delete cascade,
  name text,
  role text not null default 'Consultation'
);

alter table public.profiles enable row level security;

drop policy if exists "Lecture de son propre profil" on public.profiles;

-- Chaque utilisateur ne peut lire que SON propre profil (donc son rôle).
create policy "Lecture de son propre profil"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);
