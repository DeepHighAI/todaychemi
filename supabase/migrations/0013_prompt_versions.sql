-- supabase/migrations/0013_prompt_versions.sql
create table public.prompt_versions (
  prompt_name  text    not null,
  version      text    not null,
  content      text    not null,
  status       text    not null check (status in ('active', 'canary', 'rolled_back')),
  canary_ratio numeric(3,2) check (canary_ratio >= 0 and canary_ratio <= 1),
  notes        text,
  created_at   timestamptz not null default now(),
  primary key  (prompt_name, version)
);

-- prompt_name 당 active 버전은 하나만
create unique index prompt_versions_one_active
  on public.prompt_versions (prompt_name)
  where status = 'active';

alter table public.prompt_versions enable row level security;
create policy "prompt_versions_public_read" on public.prompt_versions
  for select using (true);
-- write는 service_role 전용
