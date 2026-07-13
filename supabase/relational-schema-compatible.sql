-- =====================================================================
-- MIENRA Web - Schema relationnel Supabase compatible SQL Editor
-- Version 1.1 - EPV Mienrassou
--
-- Ce fichier prepare une vraie base relationnelle pour une utilisation
-- sur une annee scolaire complete. Il garde des colonnes legacy_id pour
-- migrer les donnees existantes depuis l'ancien etat JSON.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables principales
-- ---------------------------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  code text not null,
  phone text,
  email text,
  address text,
  director text,
  receipt_prefix text not null default 'REC',
  receipt_footer text not null default 'Merci pour votre paiement.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  legacy_id text,
  name text not null,
  level text not null,
  fee integer not null check (fee >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  legacy_id text,
  matricule text not null,
  name text not null,
  gender text check (gender in ('M', 'F')),
  birth date,
  entry_date date,
  added_date date not null default current_date,
  class_id uuid references public.classes(id) on delete set null,
  parent_name text,
  phone text,
  address text,
  status text not null default 'Actif' check (status in ('Actif', 'Redoublant', 'Abandon', 'Inactif', 'Transfere', 'Transféré')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, matricule)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  legacy_id text,
  student_id uuid not null references public.students(id) on delete restrict,
  school_year_id uuid not null references public.school_years(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  amount integer not null check (amount >= 0),
  discount integer not null default 0 check (discount >= 0),
  enrolled_on date not null default current_date,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount <= amount),
  unique (student_id, school_year_id)
);

create table if not exists public.receipt_counters (
  school_id uuid not null references public.schools(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  last_number integer not null default 0,
  primary key (school_id, school_year_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  legacy_id text,
  student_id uuid not null references public.students(id) on delete restrict,
  school_year_id uuid not null references public.school_years(id) on delete restrict,
  receipt_no text not null,
  amount integer not null check (amount > 0),
  expected_at_payment integer not null default 0 check (expected_at_payment >= 0),
  paid_before integer not null default 0 check (paid_before >= 0),
  total_paid_after integer not null default 0 check (total_paid_after >= 0),
  balance_after integer not null default 0,
  paid_by text,
  mode text not null check (mode in ('Especes', 'Espèces', 'Orange Money', 'Moov Money', 'MTN Money', 'Wave')),
  paid_on date not null default current_date,
  cashier text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, receipt_no)
);

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  legacy_id text,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  role text,
  type text,
  action text not null,
  detail text,
  device text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Profils et roles
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('Administrateur', 'Directeur', 'Secretaire', 'Secrétaire', 'Consultation'));

-- ---------------------------------------------------------------------
-- Donnees de base EPV Mienrassou
-- ---------------------------------------------------------------------
insert into public.schools (slug, name, code, phone, address, director)
values ('epv-mienrassou', 'EPV Mienrassou', 'EPVM', '07 07 70 44 54', 'Mienrassou - Daloa', 'Direction de l''ecole')
on conflict (slug) do update
set name = excluded.name,
    code = excluded.code,
    phone = excluded.phone,
    address = excluded.address,
    director = excluded.director;

insert into public.school_years (school_id, name, is_active)
select id, '2026-2027', true from public.schools where slug = 'epv-mienrassou'
on conflict (school_id, name) do update set is_active = excluded.is_active;

insert into public.classes (school_id, name, level, fee)
select s.id, v.name, v.level, v.fee
from public.schools s
cross join (values
  ('Maternelle', 'Maternelle', 70000),
  ('CP1', 'Primaire', 70000),
  ('CP2', 'Primaire', 70000),
  ('CE1', 'Primaire', 70000),
  ('CE2', 'Primaire', 70000),
  ('CM1', 'Primaire', 70000),
  ('CM2', 'Primaire', 75000)
) as v(name, level, fee)
where s.slug = 'epv-mienrassou'
on conflict (school_id, name) do update set level = excluded.level, fee = excluded.fee;

update public.profiles
set school_id = (select id from public.schools where slug = 'epv-mienrassou')
where school_id is null;

-- ---------------------------------------------------------------------
-- Fonctions utilitaires / autorisation
-- ---------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active = true
$$;

create or replace function public.current_profile_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.school_id from public.profiles p where p.id = auth.uid() and p.active = true
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'Administrateur', false)
$$;

create or replace function public.can_manage_school_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('Administrateur', 'Directeur', 'Secretaire', 'Secrétaire')
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_schools_updated_at on public.schools;
create trigger trg_schools_updated_at before update on public.schools for each row execute function public.touch_updated_at();

drop trigger if exists trg_classes_updated_at on public.classes;
create trigger trg_classes_updated_at before update on public.classes for each row execute function public.touch_updated_at();

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at before update on public.students for each row execute function public.touch_updated_at();

drop trigger if exists trg_enrollments_updated_at on public.enrollments;
create trigger trg_enrollments_updated_at before update on public.enrollments for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------
create unique index if not exists uq_classes_school_legacy on public.classes(school_id, legacy_id) where legacy_id is not null;
create unique index if not exists uq_students_school_legacy on public.students(school_id, legacy_id) where legacy_id is not null;
create unique index if not exists uq_enrollments_school_legacy on public.enrollments(school_id, legacy_id) where legacy_id is not null;
create unique index if not exists uq_payments_school_legacy on public.payments(school_id, legacy_id) where legacy_id is not null;
create index if not exists idx_students_school_class on public.students(school_id, class_id);
create index if not exists idx_students_school_status on public.students(school_id, status);
create index if not exists idx_enrollments_student_year on public.enrollments(student_id, school_year_id);
create index if not exists idx_payments_student_year on public.payments(student_id, school_year_id);
create index if not exists idx_payments_school_date on public.payments(school_id, paid_on desc);
create index if not exists idx_app_logs_school_date on public.app_logs(school_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS et policies compatibles
-- ---------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.school_years enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.payments enable row level security;
alter table public.app_logs enable row level security;

drop policy if exists "schools read own school" on public.schools;
create policy "schools read own school" on public.schools for select to authenticated using (id = public.current_profile_school_id());

drop policy if exists "schools admin update own school" on public.schools;
create policy "schools admin update own school" on public.schools for update to authenticated using (id = public.current_profile_school_id() and public.is_admin()) with check (id = public.current_profile_school_id() and public.is_admin());

drop policy if exists "years read own school" on public.school_years;
create policy "years read own school" on public.school_years for select to authenticated using (school_id = public.current_profile_school_id());

drop policy if exists "years manage own school" on public.school_years;
create policy "years manage own school" on public.school_years for all to authenticated using (school_id = public.current_profile_school_id() and public.can_manage_school_data()) with check (school_id = public.current_profile_school_id() and public.can_manage_school_data());

drop policy if exists "classes read own school" on public.classes;
create policy "classes read own school" on public.classes for select to authenticated using (school_id = public.current_profile_school_id());

drop policy if exists "classes manage own school" on public.classes;
create policy "classes manage own school" on public.classes for all to authenticated using (school_id = public.current_profile_school_id() and public.can_manage_school_data()) with check (school_id = public.current_profile_school_id() and public.can_manage_school_data());

drop policy if exists "students read own school" on public.students;
create policy "students read own school" on public.students for select to authenticated using (school_id = public.current_profile_school_id());

drop policy if exists "students manage own school" on public.students;
create policy "students manage own school" on public.students for all to authenticated using (school_id = public.current_profile_school_id() and public.can_manage_school_data()) with check (school_id = public.current_profile_school_id() and public.can_manage_school_data());

drop policy if exists "enrollments read own school" on public.enrollments;
create policy "enrollments read own school" on public.enrollments for select to authenticated using (school_id = public.current_profile_school_id());

drop policy if exists "enrollments insert own school" on public.enrollments;
create policy "enrollments insert own school" on public.enrollments for insert to authenticated with check (school_id = public.current_profile_school_id() and public.can_manage_school_data());

drop policy if exists "enrollments update admin only" on public.enrollments;
create policy "enrollments update admin only" on public.enrollments for update to authenticated using (school_id = public.current_profile_school_id() and public.is_admin()) with check (school_id = public.current_profile_school_id() and public.is_admin());

drop policy if exists "enrollments delete admin only" on public.enrollments;
create policy "enrollments delete admin only" on public.enrollments for delete to authenticated using (school_id = public.current_profile_school_id() and public.is_admin());

drop policy if exists "payments read own school" on public.payments;
create policy "payments read own school" on public.payments for select to authenticated using (school_id = public.current_profile_school_id());

drop policy if exists "payments insert own school" on public.payments;
create policy "payments insert own school" on public.payments for insert to authenticated with check (school_id = public.current_profile_school_id() and public.can_manage_school_data());

drop policy if exists "payments update admin only" on public.payments;
create policy "payments update admin only" on public.payments for update to authenticated using (school_id = public.current_profile_school_id() and public.is_admin()) with check (school_id = public.current_profile_school_id() and public.is_admin());

drop policy if exists "payments delete admin only" on public.payments;
create policy "payments delete admin only" on public.payments for delete to authenticated using (school_id = public.current_profile_school_id() and public.is_admin());

drop policy if exists "receipt counters read own school" on public.receipt_counters;
create policy "receipt counters read own school" on public.receipt_counters for select to authenticated using (school_id = public.current_profile_school_id());

drop policy if exists "receipt counters manage own school" on public.receipt_counters;
create policy "receipt counters manage own school" on public.receipt_counters for all to authenticated using (school_id = public.current_profile_school_id() and public.can_manage_school_data()) with check (school_id = public.current_profile_school_id() and public.can_manage_school_data());

drop policy if exists "logs read own school" on public.app_logs;
create policy "logs read own school" on public.app_logs for select to authenticated using (school_id = public.current_profile_school_id());

drop policy if exists "logs insert own school" on public.app_logs;
create policy "logs insert own school" on public.app_logs for insert to authenticated with check (school_id = public.current_profile_school_id());

-- ---------------------------------------------------------------------
-- Vue de suivi financier
-- ---------------------------------------------------------------------
create or replace view public.student_payment_summary as
select
  st.school_id,
  st.id as student_id,
  st.matricule,
  st.name,
  st.gender,
  st.status as student_status,
  c.name as class_name,
  y.name as school_year,
  coalesce(e.amount - e.discount, c.fee, 0) as expected_amount,
  coalesce(sum(p.amount), 0)::integer as paid_amount,
  (coalesce(e.amount - e.discount, c.fee, 0) - coalesce(sum(p.amount), 0))::integer as remaining_amount,
  case
    when coalesce(sum(p.amount), 0) <= 0 then 'Sans paiement'
    when coalesce(sum(p.amount), 0) >= coalesce(e.amount - e.discount, c.fee, 0) then 'Soldé'
    else 'Partiel'
  end as payment_status
from public.students st
left join public.classes c on c.id = st.class_id
left join public.enrollments e on e.student_id = st.id
left join public.school_years y on y.id = e.school_year_id
left join public.payments p on p.student_id = st.id and p.school_year_id = e.school_year_id
group by st.school_id, st.id, st.matricule, st.name, st.gender, st.status, c.name, c.fee, y.name, e.amount, e.discount;

-- =====================================================================
-- Fin. Executer ensuite supabase/migrate-json-to-relational.sql si des
-- donnees existent deja dans public.mienra_app_state.
-- =====================================================================
