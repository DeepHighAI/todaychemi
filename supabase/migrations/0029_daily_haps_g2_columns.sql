-- 0029_daily_haps_g2_columns.sql
-- G2 / Phase 3 F1.1 (2026-05-28): 오늘카드 인연 종합 영속화 컬럼 2건 + llm_model default 격상.
-- 기존 primary_relation_id (0008) 컬럼은 그대로 활용 — 본 마이그레이션은 nickname 스냅샷 + today_compat_score 만 추가.
-- relation_nickname: relations.nickname 가 변경되어도 카드 시점 표시값 보존.
-- today_compat_score: src/lib/scoring/today.ts:computeTodayCompatScore 결과 (0..100, 결정형).

alter table public.daily_haps
  add column if not exists relation_nickname text null;

alter table public.daily_haps
  add column if not exists today_compat_score smallint null check (today_compat_score between 0 and 100);

-- C5 격상에 따른 default 동기화 (오늘합 single-axis / with-relation 모두 gpt-5)
alter table public.daily_haps
  alter column llm_model set default 'gpt-5';
