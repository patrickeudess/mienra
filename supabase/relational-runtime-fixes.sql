-- =====================================================================
-- MIENRA Web - Ajustements runtime pour l'adaptateur relationnel
--
-- A executer apres relational-schema-compatible.sql si la base relationnelle
-- existe deja. Ces instructions sont non destructives.
-- =====================================================================

-- L'adaptateur JavaScript fait un upsert du journal par school_id + legacy_id.
-- Une contrainte unique est necessaire pour que l'upsert ne duplique pas les
-- traces de connexion et d'actions.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_logs_school_legacy_key'
      and conrelid = 'public.app_logs'::regclass
  ) then
    alter table public.app_logs
      add constraint app_logs_school_legacy_key unique (school_id, legacy_id);
  end if;
end $$;

-- Acces REST pour les utilisateurs authentifies. RLS reste active et filtre
-- les lignes selon l'ecole et le role.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.schools to authenticated;
grant select, insert, update, delete on public.school_years to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.enrollments to authenticated;
grant select, insert, update, delete on public.receipt_counters to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.app_logs to authenticated;

-- ---------------------------------------------------------------------
-- Reçus : compteur serveur atomique
-- ---------------------------------------------------------------------
create or replace function public.mienra_next_receipt_no(
  p_school_slug text default 'epv-mienrassou',
  p_year_name text default null,
  p_prefix text default 'REC'
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_school_id uuid;
  v_year_id uuid;
  v_year_name text;
  v_next integer;
begin
  if auth.uid() is null or not public.can_manage_school_data() then
    raise exception 'Acces refuse au compteur de recus';
  end if;

  select id into v_school_id
  from public.schools
  where slug = p_school_slug
    and id = public.current_profile_school_id()
  limit 1;

  if v_school_id is null then
    raise exception 'Ecole introuvable ou non autorisee';
  end if;

  select id, name into v_year_id, v_year_name
  from public.school_years
  where school_id = v_school_id
    and name = coalesce(p_year_name, name)
  order by case when is_active then 0 else 1 end, name desc
  limit 1;

  if v_year_id is null then
    raise exception 'Annee scolaire introuvable';
  end if;

  insert into public.receipt_counters (school_id, school_year_id, last_number)
  values (v_school_id, v_year_id, 0)
  on conflict (school_id, school_year_id) do nothing;

  update public.receipt_counters
  set last_number = last_number + 1
  where school_id = v_school_id
    and school_year_id = v_year_id
  returning last_number into v_next;

  return coalesce(nullif(p_prefix, ''), 'REC') || '-' || split_part(v_year_name, '-', 1) || '-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on function public.mienra_next_receipt_no(text, text, text) from public;
grant execute on function public.mienra_next_receipt_no(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Vue de suivi financier par eleve
-- ---------------------------------------------------------------------
drop view if exists public.student_payment_summary;
create view public.student_payment_summary
with (security_invoker = true)
as
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

grant select on public.student_payment_summary to authenticated;

-- Rapport paiement detaille, utile pour exports/controles.
drop view if exists public.payment_detail_report;
create view public.payment_detail_report
with (security_invoker = true)
as
select
  p.school_id,
  y.name as school_year,
  p.receipt_no,
  p.paid_on,
  p.amount,
  p.expected_at_payment,
  p.paid_before,
  p.total_paid_after,
  p.balance_after,
  p.paid_by,
  p.mode,
  p.cashier,
  p.note,
  st.matricule,
  st.name as student_name,
  st.gender,
  st.status as student_status,
  c.name as class_name,
  p.created_at
from public.payments p
join public.students st on st.id = p.student_id
join public.school_years y on y.id = p.school_year_id
left join public.classes c on c.id = st.class_id;

grant select on public.payment_detail_report to authenticated;

-- Point journalier administrateur/directeur : nombre d'enfants et montant.
drop view if exists public.daily_payment_report;
create view public.daily_payment_report
with (security_invoker = true)
as
select
  p.school_id,
  y.name as school_year,
  p.paid_on,
  count(distinct p.student_id)::integer as student_count,
  count(*)::integer as payment_count,
  coalesce(sum(p.amount), 0)::integer as collected_amount,
  coalesce(sum(p.balance_after), 0)::integer as balance_after_sum
from public.payments p
join public.school_years y on y.id = p.school_year_id
group by p.school_id, y.name, p.paid_on;

grant select on public.daily_payment_report to authenticated;

-- Audit centralise : trace automatiquement les insert/update/delete critiques.
create or replace function public.mienra_audit_trigger()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_school_id uuid;
  v_action text;
  v_type text;
  v_detail text;
begin
  v_school_id := coalesce(new.school_id, old.school_id, public.current_profile_school_id());
  v_action := tg_op || ' ' || tg_table_name;
  v_type := case tg_table_name
    when 'students' then 'Eleve'
    when 'enrollments' then 'Inscription'
    when 'payments' then 'Paiement'
    when 'classes' then 'Classe'
    else 'Donnee'
  end;
  v_detail := case tg_op
    when 'DELETE' then coalesce(old.matricule, old.receipt_no, old.legacy_id, old.id::text)
    else coalesce(new.matricule, new.receipt_no, new.legacy_id, new.id::text)
  end;

  insert into public.app_logs (school_id, legacy_id, user_id, user_name, role, type, action, detail, device, created_at)
  values (
    v_school_id,
    'AUD-' || tg_table_name || '-' || coalesce(coalesce(new.id, old.id)::text, gen_random_uuid()::text) || '-' || extract(epoch from clock_timestamp())::text,
    auth.uid(),
    coalesce(public.current_profile_role(), 'Systeme'),
    public.current_profile_role(),
    v_type,
    v_action,
    v_detail,
    'Supabase',
    now()
  );

  return coalesce(new, old);
exception when others then
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_students on public.students;
create trigger trg_audit_students after insert or update or delete on public.students for each row execute function public.mienra_audit_trigger();

drop trigger if exists trg_audit_enrollments on public.enrollments;
create trigger trg_audit_enrollments after insert or update or delete on public.enrollments for each row execute function public.mienra_audit_trigger();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments after insert or update or delete on public.payments for each row execute function public.mienra_audit_trigger();

drop trigger if exists trg_audit_classes on public.classes;
create trigger trg_audit_classes after insert or update or delete on public.classes for each row execute function public.mienra_audit_trigger();
