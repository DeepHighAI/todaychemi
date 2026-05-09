-- supabase/migrations/0008_daily_haps.sql
create table public.daily_haps (
  hap_id                uuid    primary key default gen_random_uuid(),
  user_id               uuid    not null references public.users(user_id) on delete cascade,
  primary_relation_id   uuid    references public.relations(relation_id) on delete set null,
  target_date           date    not null,                           -- KST 기준
  headline              text    not null,
  headline_reason       text    not null,
  avoid_phrase          text    not null,
  avoid_phrase_reason   text    not null,
  favorable_action      text    not null,
  favorable_action_reason text  not null,
  source_packet_hash    text    not null,
  reused_from_yesterday boolean not null default false,
  llm_model             text    not null default 'gpt-5-mini',
  generated_at          timestamptz not null default now(),
  unique(user_id, target_date)
);

create index on public.daily_haps (user_id, target_date desc);

alter table public.daily_haps enable row level security;
create policy "daily_haps_own" on public.daily_haps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6개월 자동 삭제 (pg_cron)
select cron.schedule(
  'delete-old-daily-haps',
  '0 3 1 * *',
  $$delete from public.daily_haps where target_date < current_date - interval '6 months'$$
);
