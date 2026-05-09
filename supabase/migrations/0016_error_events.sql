-- supabase/migrations/0016_error_events.sql
create table public.error_events (
  event_id       uuid    primary key default gen_random_uuid(),
  user_id        uuid    references public.users(user_id) on delete set null,
  error_code     text    not null,
  chart_hash     text,
  prompt_version text,
  context        jsonb,
  stack          text,
  created_at     timestamptz not null default now()
);

create index on public.error_events (error_code, created_at desc);
create index on public.error_events (user_id, created_at desc);

alter table public.error_events enable row level security;
-- RLS enabled, no policies (service_role only)
