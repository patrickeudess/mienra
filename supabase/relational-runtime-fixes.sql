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

-- La vue est un support de rapport. Sur Postgres 15+, security_invoker evite
-- qu'une vue contourne les policies RLS des tables sources.
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
