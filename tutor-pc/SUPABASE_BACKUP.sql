-- Backup dos dados de aprendizado na nuvem (Soaken).
-- Rode UMA VEZ no Supabase: Dashboard → SQL Editor → cole tudo → Run.
-- Cada usuário só enxerga/escreve a PRÓPRIA linha (RLS).

create table if not exists public.user_store (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_store enable row level security;

-- Uma policy "tudo" só na própria linha (select/insert/update/delete).
drop policy if exists "own row" on public.user_store;
create policy "own row" on public.user_store
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
