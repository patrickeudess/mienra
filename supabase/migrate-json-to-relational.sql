-- =====================================================================
-- MIENRA Web - Migration JSON vers base relationnelle
--
-- A executer APRES supabase/relational-schema-compatible.sql.
-- Le script ne supprime pas public.mienra_app_state : il copie les donnees
-- vers les nouvelles tables relationnelles et conserve les legacy_id.
-- =====================================================================

create or replace function public.mienra_safe_date(value text)
returns date
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  return value::date;
exception when others then
  return null;
end;
$$;

create or replace function public.mienra_safe_int(value text, fallback integer default 0)
returns integer
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return fallback;
  end if;
  return value::integer;
exception when others then
  return fallback;
end;
$$;

do $$
declare
  v_state jsonb;
  v_school_id uuid;
  v_active_year text;
  v_row jsonb;
  v_student_id uuid;
  v_class_id uuid;
  v_year_id uuid;
  v_receipt text;
  v_max_receipt integer;
begin
  select data into v_state
  from public.mienra_app_state
  where id = 'epp-mienrassou';

  if v_state is null then
    raise exception 'Aucune donnee trouvee dans public.mienra_app_state pour id=epp-mienrassou';
  end if;

  select id into v_school_id from public.schools where slug = 'epv-mienrassou';
  if v_school_id is null then
    raise exception 'Ecole epv-mienrassou introuvable. Executez d abord relational-schema-compatible.sql';
  end if;

  v_active_year := coalesce(v_state->>'activeYear', '2026-2027');

  update public.schools
  set name = coalesce(v_state #>> '{school,name}', name),
      code = coalesce(v_state #>> '{school,code}', code),
      phone = coalesce(v_state #>> '{school,phone}', phone),
      email = coalesce(v_state #>> '{school,email}', email),
      address = coalesce(v_state #>> '{school,address}', address),
      director = coalesce(v_state #>> '{school,director}', director),
      receipt_footer = coalesce(v_state #>> '{school,receiptFooter}', receipt_footer)
  where id = v_school_id;

  -- Annees scolaires
  if jsonb_typeof(v_state->'years') = 'array' then
    insert into public.school_years (school_id, name, is_active)
    select v_school_id, y.value, y.value = v_active_year
    from jsonb_array_elements_text(v_state->'years') as y(value)
    on conflict (school_id, name) do update set is_active = excluded.is_active;
  end if;

  insert into public.school_years (school_id, name, is_active)
  values (v_school_id, v_active_year, true)
  on conflict (school_id, name) do update set is_active = true;

  -- Classes
  if jsonb_typeof(v_state->'classes') = 'array' then
    for v_row in select value from jsonb_array_elements(v_state->'classes') loop
      insert into public.classes (school_id, legacy_id, name, level, fee)
      values (
        v_school_id,
        nullif(v_row->>'id', ''),
        coalesce(nullif(v_row->>'name', ''), 'Classe sans nom'),
        coalesce(nullif(v_row->>'level', ''), 'Primaire'),
        public.mienra_safe_int(v_row->>'fee', 0)
      )
      on conflict (school_id, name) do update
      set legacy_id = coalesce(public.classes.legacy_id, excluded.legacy_id),
          level = excluded.level,
          fee = excluded.fee;
    end loop;
  end if;

  -- Eleves
  if jsonb_typeof(v_state->'students') = 'array' then
    for v_row in select value from jsonb_array_elements(v_state->'students') loop
      select id into v_class_id
      from public.classes
      where school_id = v_school_id
        and (legacy_id = v_row->>'classId' or name = v_row->>'className' or name = v_row->>'class')
      order by case when legacy_id = v_row->>'classId' then 0 else 1 end
      limit 1;

      insert into public.students (
        school_id, legacy_id, matricule, name, gender, birth, entry_date,
        added_date, class_id, parent_name, phone, address, status
      )
      values (
        v_school_id,
        nullif(v_row->>'id', ''),
        coalesce(nullif(v_row->>'matricule', ''), 'EPVM-' || extract(year from current_date)::text || '-' || lpad(substr(md5(coalesce(v_row->>'id', random()::text)), 1, 6), 6, '0')),
        coalesce(nullif(v_row->>'name', ''), nullif(v_row->>'fullName', ''), 'Eleve sans nom'),
        nullif(v_row->>'gender', ''),
        public.mienra_safe_date(coalesce(v_row->>'birth', v_row->>'birthDate')),
        public.mienra_safe_date(coalesce(v_row->>'entryDate', v_row->>'joinedAt')),
        coalesce(public.mienra_safe_date(coalesce(v_row->>'addedDate', v_row->>'createdAt')), current_date),
        v_class_id,
        coalesce(nullif(v_row->>'parentName', ''), nullif(v_row->>'parent', '')),
        coalesce(nullif(v_row->>'phone', ''), nullif(v_row->>'contact', '')),
        nullif(v_row->>'address', ''),
        coalesce(nullif(v_row->>'status', ''), 'Actif')
      )
      on conflict (school_id, matricule) do update
      set legacy_id = coalesce(public.students.legacy_id, excluded.legacy_id),
          name = excluded.name,
          gender = excluded.gender,
          birth = excluded.birth,
          entry_date = excluded.entry_date,
          added_date = excluded.added_date,
          class_id = excluded.class_id,
          parent_name = excluded.parent_name,
          phone = excluded.phone,
          address = excluded.address,
          status = excluded.status;
    end loop;
  end if;

  -- Inscriptions
  if jsonb_typeof(v_state->'enrollments') = 'array' then
    for v_row in select value from jsonb_array_elements(v_state->'enrollments') loop
      select id into v_student_id from public.students
      where school_id = v_school_id and (legacy_id = v_row->>'studentId' or matricule = v_row->>'matricule')
      limit 1;

      select id into v_class_id from public.classes
      where school_id = v_school_id and (legacy_id = v_row->>'classId' or name = v_row->>'className' or name = v_row->>'class')
      limit 1;

      select id into v_year_id from public.school_years
      where school_id = v_school_id and name = coalesce(nullif(v_row->>'year', ''), v_active_year)
      limit 1;

      if v_student_id is not null and v_class_id is not null and v_year_id is not null then
        insert into public.enrollments (school_id, legacy_id, student_id, school_year_id, class_id, amount, discount, enrolled_on, note)
        values (
          v_school_id,
          nullif(v_row->>'id', ''),
          v_student_id,
          v_year_id,
          v_class_id,
          public.mienra_safe_int(coalesce(v_row->>'amount', v_row->>'fee'), 0),
          public.mienra_safe_int(v_row->>'discount', 0),
          coalesce(public.mienra_safe_date(coalesce(v_row->>'date', v_row->>'enrolledOn')), current_date),
          nullif(v_row->>'note', '')
        )
        on conflict (student_id, school_year_id) do update
        set legacy_id = coalesce(public.enrollments.legacy_id, excluded.legacy_id),
            class_id = excluded.class_id,
            amount = excluded.amount,
            discount = excluded.discount,
            enrolled_on = excluded.enrolled_on,
            note = excluded.note;
      end if;
    end loop;
  end if;

  -- Paiements
  if jsonb_typeof(v_state->'payments') = 'array' then
    for v_row in select value from jsonb_array_elements(v_state->'payments') loop
      select id into v_student_id from public.students
      where school_id = v_school_id and (legacy_id = v_row->>'studentId' or matricule = v_row->>'matricule')
      limit 1;

      select id into v_year_id from public.school_years
      where school_id = v_school_id and name = coalesce(nullif(v_row->>'year', ''), v_active_year)
      limit 1;

      v_receipt := coalesce(nullif(v_row->>'receiptNo', ''), nullif(v_row->>'receiptNumber', ''), nullif(v_row->>'number', ''), 'REC-MIG-' || substr(md5(coalesce(v_row->>'id', random()::text)), 1, 10));

      if v_student_id is not null and v_year_id is not null then
        insert into public.payments (
          school_id, legacy_id, student_id, school_year_id, receipt_no, amount,
          expected_at_payment, paid_before, total_paid_after, balance_after,
          paid_by, mode, paid_on, cashier, note
        )
        values (
          v_school_id,
          nullif(v_row->>'id', ''),
          v_student_id,
          v_year_id,
          v_receipt,
          public.mienra_safe_int(v_row->>'amount', 0),
          public.mienra_safe_int(v_row->>'expectedAtPayment', 0),
          public.mienra_safe_int(v_row->>'paidBefore', 0),
          public.mienra_safe_int(v_row->>'totalPaidAfter', 0),
          public.mienra_safe_int(v_row->>'balanceAfter', 0),
          nullif(v_row->>'paidBy', ''),
          coalesce(nullif(v_row->>'mode', ''), 'Especes'),
          coalesce(public.mienra_safe_date(coalesce(v_row->>'date', v_row->>'paidOn')), current_date),
          nullif(v_row->>'cashier', ''),
          nullif(v_row->>'note', '')
        )
        on conflict (school_id, receipt_no) do update
        set legacy_id = coalesce(public.payments.legacy_id, excluded.legacy_id),
            amount = excluded.amount,
            expected_at_payment = excluded.expected_at_payment,
            paid_before = excluded.paid_before,
            total_paid_after = excluded.total_paid_after,
            balance_after = excluded.balance_after,
            paid_by = excluded.paid_by,
            mode = excluded.mode,
            paid_on = excluded.paid_on,
            cashier = excluded.cashier,
            note = excluded.note;
      end if;
    end loop;
  end if;

  -- Journal / traces
  if jsonb_typeof(v_state->'logs') = 'array' then
    for v_row in select value from jsonb_array_elements(v_state->'logs') loop
      insert into public.app_logs (school_id, legacy_id, user_name, role, type, action, detail, device, created_at)
      values (
        v_school_id,
        nullif(v_row->>'id', ''),
        nullif(v_row->>'user', ''),
        nullif(v_row->>'role', ''),
        nullif(v_row->>'type', ''),
        coalesce(nullif(v_row->>'action', ''), 'Operation importee'),
        nullif(v_row->>'detail', ''),
        nullif(v_row->>'device', ''),
        coalesce((public.mienra_safe_date(v_row->>'date'))::timestamptz, now())
      )
      on conflict do nothing;
    end loop;
  end if;

  -- Compteur de recus : essaie de reprendre le plus grand numero numerique.
  select max((regexp_match(receipt_no, '(\d+)$'))[1]::integer)
  into v_max_receipt
  from public.payments
  where school_id = v_school_id and receipt_no ~ '\d+$';

  insert into public.receipt_counters (school_id, school_year_id, last_number)
  select v_school_id, y.id, coalesce(v_max_receipt, 0)
  from public.school_years y
  where y.school_id = v_school_id and y.name = v_active_year
  on conflict (school_id, school_year_id) do update
  set last_number = greatest(public.receipt_counters.last_number, excluded.last_number);

  raise notice 'Migration terminee pour EPV Mienrassou.';
end $$;

-- Verification rapide apres execution :
-- select 'classes' table_name, count(*) from public.classes union all
-- select 'students', count(*) from public.students union all
-- select 'enrollments', count(*) from public.enrollments union all
-- select 'payments', count(*) from public.payments union all
-- select 'logs', count(*) from public.app_logs;
