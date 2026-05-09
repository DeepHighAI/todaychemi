-- supabase/migrations/0006_hapcards.sql
create table public.hapcards (
  hapcard_id       uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  relation_id      uuid    not null references public.relations(relation_id) on delete cascade,
  mode             text    not null check (mode in (
                     '일합', '친구합', '돈합', '첫합', '썸합', '오래합'
                   )),
  compat_score     numeric(5,2) not null,   -- ADR-035: 결정형 점수, LLM 개입 금지
  score_breakdown  jsonb   not null,        -- 항목별 점수 (category_scores)
  content          jsonb   not null,        -- main_text, cause_factors, classic_citation, actions, why_cards
  prompt_version   text    not null,
  llm_model        text    not null check (llm_model in ('gpt-5o', 'gpt-5', 'gpt-5-mini', 'claude-fallback')),
  cache_key        text    not null unique,
  user_chart_hash  text    not null,
  relation_chart_hash text not null,
  archived_at      timestamptz,
  version_label    text,
  created_at       timestamptz not null default now()
);

create index on public.hapcards (user_id, relation_id, mode);
create index on public.hapcards (user_id, created_at desc);
create index on public.hapcards (cache_key);

alter table public.hapcards enable row level security;
create policy "hapcards_own" on public.hapcards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
