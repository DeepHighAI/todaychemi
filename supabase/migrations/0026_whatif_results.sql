-- supabase/migrations/0026_whatif_results.sql
-- S-08: 마이플레이 6종 LLM 응답 캐시 (DiagnosticType: work/love/conflict/leadership/money/first_meet)
-- 패턴: 0006_hapcards.sql 미러(self-anchor, relation 없음, scoring 없음)
create table public.whatif_results (
  whatif_id        uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  type             text    not null check (type in (
                     'work', 'love', 'conflict', 'leadership', 'money', 'first_meet'
                   )),
  content          jsonb   not null,        -- WhatifContent: body+keywords+do_first+first_meet_tips?
  prompt_version   text    not null,
  llm_model        text    not null check (llm_model in (
                     'gpt-5o', 'gpt-5', 'gpt-5-mini', 'claude-fallback'
                   )),
  cache_key        text    not null unique,  -- sha256(chart_hash + type + prompt_version)
  chart_hash       text    not null,
  created_at       timestamptz not null default now()
);

create index on public.whatif_results (user_id, type, created_at desc);
create index on public.whatif_results (cache_key);

alter table public.whatif_results enable row level security;
create policy "whatif_results_own" on public.whatif_results for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
