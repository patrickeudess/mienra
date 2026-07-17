-- Journal serveur des connexions et actions applicatives.

create or replace function public.mienra_log_event(
  p_action text,
  p_type text default 'Action',
  p_detail text default '',
  p_device text default 'Navigateur'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_name text;
  v_role text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select p.school_id, p.name, p.role into v_school_id, v_name, v_role
  from public.profiles p where p.id = auth.uid() limit 1;
  if v_school_id is null then raise exception 'Profil non autorise'; end if;

  insert into public.app_logs (
    school_id, legacy_id, user_id, user_name, role,
    type, action, detail, device, created_at
  ) values (
    v_school_id, 'EVT-' || gen_random_uuid()::text, auth.uid(), v_name, v_role,
    coalesce(nullif(btrim(p_type), ''), 'Action'),
    coalesce(nullif(btrim(p_action), ''), 'Operation'),
    nullif(btrim(p_detail), ''),
    coalesce(nullif(btrim(p_device), ''), 'Navigateur'),
    now()
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.mienra_log_event(text, text, text, text) from public;
revoke all on function public.mienra_log_event(text, text, text, text) from anon;
grant execute on function public.mienra_log_event(text, text, text, text) to authenticated;
