-- =====================================================================
-- MIENRA Web - Controles apres migration relationnelle
-- A executer dans Supabase SQL Editor apres les scripts de schema/runtime.
-- =====================================================================

-- 1) Comptage des donnees principales
select 'classes' as table_name, count(*) from public.classes
union all select 'students', count(*) from public.students
union all select 'enrollments', count(*) from public.enrollments
union all select 'payments', count(*) from public.payments
union all select 'logs', count(*) from public.app_logs;

-- 2) Controle des doublons de matricule
select school_id, matricule, count(*)
from public.students
group by school_id, matricule
having count(*) > 1;

-- 3) Controle des doublons de recu
select school_id, receipt_no, count(*)
from public.payments
group by school_id, receipt_no
having count(*) > 1;

-- 4) Suivi financier par eleve
select *
from public.student_payment_summary
order by class_name, name
limit 50;

-- 5) Point journalier
select *
from public.daily_payment_report
order by paid_on desc
limit 30;

-- 6) Historique detaille des paiements
select *
from public.payment_detail_report
order by paid_on desc, created_at desc
limit 50;

-- 7) Dernieres traces audit/app
select created_at, type, role, action, detail, device
from public.app_logs
order by created_at desc
limit 50;
