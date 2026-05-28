-- 0030_error_events_authenticated_insert.sql
-- Task 1 instrumentation 회귀 fix (QA 2026-05-28 ISSUE-002):
-- 0016 에서 error_events 에 RLS enabled + 0 policies → user client (authenticated) INSERT 가 silently 차단되어
-- (1) lazy-relation-chart.ts:F3.3 KASI_COMPUTE_FAIL 적재
-- (2) /api/today route.ts:recordTrace LLM_TIMEOUT/LLM_PARSE_FAIL/TODAY_BUILD_FAIL 적재
-- 모두 작동하지 않았음 (테이블 0 row 검증). service_role 은 RLS bypass 이므로 영향 없음.
--
-- 본 마이그레이션은 authenticated user 가 본인 user_id 로 INSERT 만 허용. SELECT 정책은 추가하지 않음
-- (사용자가 자기 trace 를 직접 읽을 수단은 본 PR 범위 외).

create policy "error_events authenticated insert own"
  on public.error_events
  for insert
  to authenticated
  with check (user_id = auth.uid());
