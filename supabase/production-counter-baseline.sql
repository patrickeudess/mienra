-- Aligne les compteurs eleves sur les matricules deja enregistres.

insert into public.student_counters (school_id, school_year_id, last_number)
select
  s.id,
  y.id,
  coalesce((
    select max((regexp_match(st.matricule, '(\d+)$'))[1]::integer)
    from public.students st
    where st.school_id = s.id
      and st.matricule like '%-' || split_part(y.name, '-', 1) || '-%'
      and st.matricule ~ '\d+$'
  ), 0)
from public.schools s
join public.school_years y on y.school_id = s.id
on conflict (school_id, school_year_id) do update
set last_number = greatest(public.student_counters.last_number, excluded.last_number),
    updated_at = now();
