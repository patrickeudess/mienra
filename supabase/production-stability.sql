-- MIENRA Web - stabilite production, temps reel et matricules atomiques.

create table if not exists public.student_counters (
  school_id uuid not null references public.schools(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (school_id, school_year_id)
);

alter table public.student_counters enable row level security;
grant select on public.student_counters to authenticated;

drop policy if exists "student counters read own school" on public.student_counters;
create policy "student counters read own school"
on public.student_counters for select to authenticated
using (school_id = public.current_profile_school_id());

create or replace function public.mienra_next_student_matricule(
  p_school_slug text default 'epv-mienrassou',
  p_year_name text default null,
  p_prefix text default 'EPVM'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_year_id uuid;
  v_year_name text;
  v_year_start text;
  v_existing_max integer;
  v_next integer;
begin
  if auth.uid() is null or not public.can_manage_school_data() then
    raise exception 'Acces refuse au compteur des eleves';
  end if;

  select s.id into v_school_id
  from public.schools s
  where s.slug = p_school_slug and s.id = public.current_profile_school_id()
  limit 1;
  if v_school_id is null then raise exception 'Ecole introuvable ou non autorisee'; end if;

  select y.id, y.name into v_year_id, v_year_name
  from public.school_years y
  where y.school_id = v_school_id and y.name = coalesce(p_year_name, y.name)
  order by case when y.is_active then 0 else 1 end, y.name desc
  limit 1;
  if v_year_id is null then raise exception 'Annee scolaire introuvable'; end if;

  v_year_start := split_part(v_year_name, '-', 1);
  perform pg_advisory_xact_lock(hashtextextended(v_school_id::text || ':student-counter:' || v_year_id::text, 0));

  select coalesce(max((regexp_match(st.matricule, '(\d+)$'))[1]::integer), 0)
  into v_existing_max
  from public.students st
  where st.school_id = v_school_id
    and st.matricule like coalesce(nullif(p_prefix, ''), 'EPVM') || '-' || v_year_start || '-%'
    and st.matricule ~ '\d+$';

  insert into public.student_counters (school_id, school_year_id, last_number)
  values (v_school_id, v_year_id, v_existing_max)
  on conflict (school_id, school_year_id) do update
  set last_number = greatest(public.student_counters.last_number, excluded.last_number),
      updated_at = now();

  update public.student_counters
  set last_number = last_number + 1, updated_at = now()
  where school_id = v_school_id and school_year_id = v_year_id
  returning last_number into v_next;

  return coalesce(nullif(p_prefix, ''), 'EPVM') || '-' || v_year_start || '-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on function public.mienra_next_student_matricule(text, text, text) from public;
revoke all on function public.mienra_next_student_matricule(text, text, text) from anon;
grant execute on function public.mienra_next_student_matricule(text, text, text) to authenticated;

create or replace function public.mienra_reset_number_counters(
  p_school_slug text default 'epv-mienrassou',
  p_year_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_year_id uuid;
  v_year_name text;
  v_year_start text;
  v_students integer;
  v_payments integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Action reservee a administrateur';
  end if;
  select s.id into v_school_id from public.schools s
  where s.slug = p_school_slug and s.id = public.current_profile_school_id() limit 1;
  select y.id, y.name into v_year_id, v_year_name from public.school_years y
  where y.school_id = v_school_id and y.name = coalesce(p_year_name, y.name)
  order by case when y.is_active then 0 else 1 end, y.name desc limit 1;
  if v_school_id is null or v_year_id is null then raise exception 'Ecole ou annee introuvable'; end if;

  v_year_start := split_part(v_year_name, '-', 1);
  select count(*)::integer into v_students from public.students st
  where st.school_id = v_school_id and st.matricule like '%-' || v_year_start || '-%';
  select count(*)::integer into v_payments from public.payments p
  where p.school_id = v_school_id and p.school_year_id = v_year_id;
  if v_students > 0 or v_payments > 0 then
    raise exception 'Remise a zero refusee: % eleve(s) et % paiement(s) existent encore', v_students, v_payments;
  end if;

  insert into public.student_counters (school_id, school_year_id, last_number)
  values (v_school_id, v_year_id, 0)
  on conflict (school_id, school_year_id) do update set last_number = 0, updated_at = now();
  insert into public.receipt_counters (school_id, school_year_id, last_number)
  values (v_school_id, v_year_id, 0)
  on conflict (school_id, school_year_id) do update set last_number = 0;
  return jsonb_build_object('school_year', v_year_name, 'student_counter', 0, 'receipt_counter', 0);
end;
$$;

revoke all on function public.mienra_reset_number_counters(text, text) from public;
revoke all on function public.mienra_reset_number_counters(text, text) from anon;
grant execute on function public.mienra_reset_number_counters(text, text) to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'schools', 'school_years', 'classes', 'students',
    'enrollments', 'payments', 'app_logs'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
