-- supabase/migrations/0005_relation_charts.sql
create table public.relation_charts (
  chart_id              uuid    primary key default gen_random_uuid(),
  relation_id           uuid    not null references public.relations(relation_id) on delete cascade,
  user_id               uuid    not null references public.users(user_id) on delete cascade,
  chart_hash            text    not null unique,
  chart_core            jsonb   not null,
  theory_profile_version text   not null,
  created_at            timestamptz not null default now()
);

create index on public.relation_charts (relation_id);
create index on public.relation_charts (user_id);

alter table public.relation_charts enable row level security;
create policy "relation_charts_own" on public.relation_charts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
