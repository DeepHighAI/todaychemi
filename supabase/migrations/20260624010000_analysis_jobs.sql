create table public.analysis_jobs (
  job_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('hapcard', 'whatif', 'replay')),
  ref text not null,
  status text not null check (status in ('running', 'completed', 'payment_required', 'failed')),
  route_payload jsonb not null default '{}'::jsonb,
  result_path text,
  error_code text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  notified_at timestamptz,
  unique (user_id, feature, ref)
);

create index if not exists analysis_jobs_user_status_updated_idx
  on public.analysis_jobs (user_id, status, updated_at desc);

create or replace function public.touch_analysis_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists analysis_jobs_touch_updated_at on public.analysis_jobs;
create trigger analysis_jobs_touch_updated_at
before update on public.analysis_jobs
for each row
execute function public.touch_analysis_jobs_updated_at();

alter table public.analysis_jobs enable row level security;

drop policy if exists "analysis_jobs_own_read" on public.analysis_jobs;
create policy "analysis_jobs_own_read"
  on public.analysis_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "analysis_jobs_own_mark_notified" on public.analysis_jobs;
create policy "analysis_jobs_own_mark_notified"
  on public.analysis_jobs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, update on public.analysis_jobs to authenticated;
grant all on public.analysis_jobs to service_role;
