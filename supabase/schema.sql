create table if not exists public.mienra_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.mienra_app_state enable row level security;

drop policy if exists "MIENRA shared app state read" on public.mienra_app_state;
drop policy if exists "MIENRA shared app state write" on public.mienra_app_state;

create policy "MIENRA shared app state read"
on public.mienra_app_state
for select
to anon
using (id = 'epp-mienrassou');

create policy "MIENRA shared app state write"
on public.mienra_app_state
for all
to anon
using (id = 'epp-mienrassou')
with check (id = 'epp-mienrassou');
