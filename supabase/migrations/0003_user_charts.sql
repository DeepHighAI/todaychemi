-- supabase/migrations/0003_user_charts.sql
create table public.user_charts (
  chart_id              uuid    primary key default gen_random_uuid(),
  user_id               uuid    not null references public.users(user_id) on delete cascade,
  chart_hash            text    not null unique,
  chart_core            jsonb   not null,  -- pillars, day_master, five_elements_balance, sinsal_tags
  theory_profile_version text   not null,
  created_at            timestamptz not null default now()
);

create index on public.user_charts (user_id);
create index on public.user_charts (chart_hash);

alter table public.user_charts enable row level security;
create policy "user_charts_self" on public.user_charts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
