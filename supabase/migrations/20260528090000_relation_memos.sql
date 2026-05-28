-- S-11 합메모: 인연당 무제한 메모(80자). 점수·LLM과 완전 분리 (island.md:183, CLAUDE.md §5).
-- 메모 추가·수정·삭제는 compat_score 에 어떠한 영향도 없음 (hapcard_score_snapshots 미기록).
create table public.relation_memos (
  memo_id      uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.users(user_id)         on delete cascade,
  relation_id  uuid        not null references public.relations(relation_id) on delete cascade,
  body         text        not null check (char_length(body) between 1 and 80),  -- 80자 상한 (3계층 중 DB 계층)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 인연별 시간순 타임라인 조회 최적화 (S-09: created_at asc)
create index relation_memos_relation_created_idx on public.relation_memos (relation_id, created_at);
create index relation_memos_user_idx             on public.relation_memos (user_id);

alter table public.relation_memos enable row level security;
create policy "relation_memos_own" on public.relation_memos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
