-- supabase/migrations/0007_hapcard_replays.sql
create table public.hapcard_replays (
  replay_id        uuid    primary key default gen_random_uuid(),
  hapcard_id       uuid    not null references public.hapcards(hapcard_id) on delete cascade,
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  replay_reason    text,                    -- 유저 입력 재해석 사유
  content          jsonb   not null,
  prompt_version   text    not null,
  llm_model        text    not null,
  created_at       timestamptz not null default now()
);

create index on public.hapcard_replays (hapcard_id);
create index on public.hapcard_replays (user_id, created_at desc);

alter table public.hapcard_replays enable row level security;
create policy "replays_own" on public.hapcard_replays for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
