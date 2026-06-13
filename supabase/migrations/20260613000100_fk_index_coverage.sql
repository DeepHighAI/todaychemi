-- 20260613000100_fk_index_coverage.sql
-- T6(c) #5 (P1-04, §1.1 승인 2026-06-13): 인덱스 없는 FK 컬럼 보강.
--
-- 부모 행 삭제 시 cascade(또는 set null) 가 자식 테이블을 FK 컬럼으로 스캔하고,
-- 조인도 동일 컬럼을 탄다. 아래 4개 FK 컬럼은 단독 인덱스가 없어 seq scan 을 유발했다.
--   - hapcard_shares.relation_id          (relations 삭제 시 cascade)
--   - hapcard_share_rewards.hapcard_id    (복합 unique(user_id,hapcard_id) 는 hapcard_id 단독 조회 미지원)
--   - hapcard_share_rewards.ledger_id     (token_ledger 삭제 시 set null)
--   - daily_haps.primary_relation_id      (relations 삭제 시 set null)
-- 모두 additive·idempotent — 동작 변화 없이 성능만 개선한다.

create index if not exists hapcard_shares_relation_idx
  on public.hapcard_shares (relation_id);

create index if not exists hapcard_share_rewards_hapcard_idx
  on public.hapcard_share_rewards (hapcard_id);

create index if not exists hapcard_share_rewards_ledger_idx
  on public.hapcard_share_rewards (ledger_id);

create index if not exists daily_haps_primary_relation_idx
  on public.daily_haps (primary_relation_id);
