-- MIENRA Web - ecritures unitaires confirmees par Supabase.

create or replace function public.mienra_save_student(
  p_school_slug text,
  p_student_ref text,
  p_matricule text,
  p_name text,
  p_gender text,
  p_birth date,
  p_entry_date date,
  p_added_date date,
  p_class_name text,
  p_parent_name text,
  p_phone text,
  p_address text,
  p_status text
)
returns public.students
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_class_id uuid;
  v_existing public.students%rowtype;
  v_result public.students%rowtype;
begin
  if auth.uid() is null or not public.can_manage_school_data() then
    raise exception 'Action non autorisee';
  end if;
  if btrim(coalesce(p_student_ref, '')) = '' then raise exception 'Identifiant eleve manquant'; end if;
  if btrim(coalesce(p_matricule, '')) = '' then raise exception 'Matricule obligatoire'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Nom obligatoire'; end if;
  if p_gender not in ('M', 'F') then raise exception 'Genre invalide'; end if;
  if p_status not in ('Actif', 'Redoublant', 'Abandon', 'Inactif', 'Transfere', 'Transféré') then
    raise exception 'Statut invalide';
  end if;

  select s.id into v_school_id
  from public.schools s
  where s.slug = p_school_slug and s.id = public.current_profile_school_id()
  limit 1;
  if v_school_id is null then raise exception 'Ecole introuvable ou non autorisee'; end if;

  select c.id into v_class_id
  from public.classes c
  where c.school_id = v_school_id and c.name = p_class_name
  limit 1;
  if v_class_id is null then raise exception 'Classe introuvable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_school_id::text || ':student:' || lower(p_matricule), 0));

  select st.* into v_existing
  from public.students st
  where st.school_id = v_school_id
    and (st.legacy_id = p_student_ref or st.id::text = p_student_ref)
  limit 1;

  if exists (
    select 1 from public.students st
    where st.school_id = v_school_id
      and lower(st.matricule) = lower(p_matricule)
      and (v_existing.id is null or st.id <> v_existing.id)
  ) then
    raise exception 'Ce matricule existe deja';
  end if;

  if v_existing.id is null then
    insert into public.students (
      school_id, legacy_id, matricule, name, gender, birth, entry_date,
      added_date, class_id, parent_name, phone, address, status
    ) values (
      v_school_id, p_student_ref, btrim(p_matricule), btrim(p_name), p_gender,
      p_birth, p_entry_date, coalesce(p_added_date, current_date), v_class_id,
      nullif(btrim(p_parent_name), ''), nullif(btrim(p_phone), ''),
      nullif(btrim(p_address), ''), p_status
    ) returning * into v_result;
  else
    update public.students
    set matricule = btrim(p_matricule),
        name = btrim(p_name),
        gender = p_gender,
        birth = p_birth,
        entry_date = p_entry_date,
        added_date = coalesce(p_added_date, added_date),
        class_id = v_class_id,
        parent_name = nullif(btrim(p_parent_name), ''),
        phone = nullif(btrim(p_phone), ''),
        address = nullif(btrim(p_address), ''),
        status = p_status
    where id = v_existing.id and school_id = v_school_id
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

create or replace function public.mienra_save_enrollment(
  p_school_slug text,
  p_enrollment_ref text,
  p_student_ref text,
  p_year_name text,
  p_class_name text,
  p_amount integer,
  p_discount integer,
  p_enrolled_on date,
  p_note text
)
returns public.enrollments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_student_id uuid;
  v_year_id uuid;
  v_class_id uuid;
  v_existing public.enrollments%rowtype;
  v_paid integer;
  v_role text;
  v_result public.enrollments%rowtype;
begin
  if auth.uid() is null or not public.can_manage_school_data() then
    raise exception 'Action non autorisee';
  end if;
  if btrim(coalesce(p_enrollment_ref, '')) = '' then raise exception 'Identifiant inscription manquant'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Montant invalide'; end if;
  if coalesce(p_discount, 0) < 0 or p_discount > p_amount then raise exception 'Remise invalide'; end if;
  v_role := public.current_profile_role();

  select s.id into v_school_id
  from public.schools s
  where s.slug = p_school_slug and s.id = public.current_profile_school_id()
  limit 1;
  if v_school_id is null then raise exception 'Ecole introuvable ou non autorisee'; end if;

  select st.id into v_student_id from public.students st
  where st.school_id = v_school_id
    and (st.legacy_id = p_student_ref or st.id::text = p_student_ref or st.matricule = p_student_ref)
  limit 1;
  if v_student_id is null then raise exception 'Eleve introuvable'; end if;

  select sy.id into v_year_id from public.school_years sy
  where sy.school_id = v_school_id and sy.name = p_year_name
  limit 1;
  if v_year_id is null then raise exception 'Annee scolaire introuvable'; end if;

  select c.id into v_class_id from public.classes c
  where c.school_id = v_school_id and c.name = p_class_name
  limit 1;
  if v_class_id is null then raise exception 'Classe introuvable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':enrollment:' || v_year_id::text, 0));

  select e.* into v_existing from public.enrollments e
  where e.school_id = v_school_id
    and (e.legacy_id = p_enrollment_ref or (e.student_id = v_student_id and e.school_year_id = v_year_id))
  limit 1;

  if v_existing.id is not null and v_existing.legacy_id = p_enrollment_ref and v_role <> 'Administrateur' then
    return v_existing;
  end if;
  if v_existing.id is not null and v_role <> 'Administrateur' then
    raise exception 'Une inscription existe deja pour cet eleve et cette annee';
  end if;

  select coalesce(sum(p.amount), 0)::integer into v_paid
  from public.payments p
  where p.school_id = v_school_id and p.student_id = v_student_id and p.school_year_id = v_year_id;
  if (p_amount - p_discount) < v_paid then
    raise exception 'Le net a payer ne peut pas etre inferieur au total deja paye';
  end if;

  if v_existing.id is null then
    insert into public.enrollments (
      school_id, legacy_id, student_id, school_year_id, class_id,
      amount, discount, enrolled_on, note, created_by
    ) values (
      v_school_id, p_enrollment_ref, v_student_id, v_year_id, v_class_id,
      p_amount, p_discount, coalesce(p_enrolled_on, current_date),
      nullif(btrim(p_note), ''), auth.uid()
    ) returning * into v_result;
  else
    update public.enrollments
    set class_id = v_class_id,
        amount = p_amount,
        discount = p_discount,
        enrolled_on = coalesce(p_enrolled_on, enrolled_on),
        note = nullif(btrim(p_note), '')
    where id = v_existing.id and school_id = v_school_id
    returning * into v_result;
  end if;

  update public.students set class_id = v_class_id
  where id = v_student_id and school_id = v_school_id;

  return v_result;
end;
$$;

create or replace function public.mienra_save_class(
  p_school_slug text,
  p_class_ref text,
  p_name text,
  p_level text,
  p_fee integer
)
returns public.classes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_existing public.classes%rowtype;
  v_result public.classes%rowtype;
begin
  if auth.uid() is null or public.current_profile_role() not in ('Administrateur', 'Directeur') then
    raise exception 'Action non autorisee';
  end if;
  if btrim(coalesce(p_class_ref, '')) = '' or btrim(coalesce(p_name, '')) = '' then
    raise exception 'Classe invalide';
  end if;
  if coalesce(p_fee, -1) < 0 then raise exception 'Frais invalides'; end if;

  select s.id into v_school_id from public.schools s
  where s.slug = p_school_slug and s.id = public.current_profile_school_id() limit 1;
  if v_school_id is null then raise exception 'Ecole introuvable ou non autorisee'; end if;

  select c.* into v_existing from public.classes c
  where c.school_id = v_school_id and (c.legacy_id = p_class_ref or c.id::text = p_class_ref)
  limit 1;

  if exists (
    select 1 from public.classes c
    where c.school_id = v_school_id and lower(c.name) = lower(p_name)
      and (v_existing.id is null or c.id <> v_existing.id)
  ) then raise exception 'Cette classe existe deja'; end if;

  if v_existing.id is null then
    insert into public.classes(school_id, legacy_id, name, level, fee)
    values(v_school_id, p_class_ref, btrim(p_name), coalesce(nullif(btrim(p_level), ''), 'Primaire'), p_fee)
    returning * into v_result;
  else
    update public.classes
    set name=btrim(p_name), level=coalesce(nullif(btrim(p_level), ''), level), fee=p_fee
    where id=v_existing.id and school_id=v_school_id
    returning * into v_result;
  end if;
  return v_result;
end;
$$;

create or replace function public.mienra_delete_class(p_class_ref text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_school_id uuid; v_count integer;
begin
  if auth.uid() is null or public.current_profile_role() not in ('Administrateur', 'Directeur') then
    raise exception 'Action non autorisee';
  end if;
  v_school_id := public.current_profile_school_id();
  delete from public.classes
  where school_id=v_school_id and (legacy_id=p_class_ref or id::text=p_class_ref);
  get diagnostics v_count = row_count;
  return v_count > 0;
end; $$;

create or replace function public.mienra_save_school_settings(
  p_school_slug text,
  p_name text,
  p_code text,
  p_year_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_director text,
  p_receipt_prefix text,
  p_receipt_footer text
)
returns public.schools
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_school_id uuid; v_result public.schools%rowtype;
begin
  if auth.uid() is null or public.current_profile_role() not in ('Administrateur', 'Directeur') then
    raise exception 'Action reservee a administrateur ou directeur';
  end if;
  select s.id into v_school_id from public.schools s
  where s.slug=p_school_slug and s.id=public.current_profile_school_id() limit 1;
  if v_school_id is null then raise exception 'Ecole introuvable ou non autorisee'; end if;

  insert into public.school_years(school_id, name, is_active)
  values(v_school_id, p_year_name, true)
  on conflict(school_id, name) do update set is_active=true;
  update public.school_years set is_active=(name=p_year_name) where school_id=v_school_id;

  update public.schools
  set name=btrim(p_name), code=btrim(p_code), phone=nullif(btrim(p_phone),''),
      email=nullif(btrim(p_email),''), address=nullif(btrim(p_address),''),
      director=nullif(btrim(p_director),''), receipt_prefix=coalesce(nullif(btrim(p_receipt_prefix),''),'REC'),
      receipt_footer=coalesce(nullif(btrim(p_receipt_footer),''),'Merci pour votre paiement.')
  where id=v_school_id
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.mienra_save_student(text,text,text,text,text,date,date,date,text,text,text,text,text) from public, anon;
revoke all on function public.mienra_save_enrollment(text,text,text,text,text,integer,integer,date,text) from public, anon;
revoke all on function public.mienra_save_class(text,text,text,text,integer) from public, anon;
revoke all on function public.mienra_delete_class(text) from public, anon;
revoke all on function public.mienra_save_school_settings(text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.mienra_save_student(text,text,text,text,text,date,date,date,text,text,text,text,text) to authenticated;
grant execute on function public.mienra_save_enrollment(text,text,text,text,text,integer,integer,date,text) to authenticated;
grant execute on function public.mienra_save_class(text,text,text,text,integer) to authenticated;
grant execute on function public.mienra_delete_class(text) to authenticated;
grant execute on function public.mienra_save_school_settings(text,text,text,text,text,text,text,text,text,text) to authenticated;
