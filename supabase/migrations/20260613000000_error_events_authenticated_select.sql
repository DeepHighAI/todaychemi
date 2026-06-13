-- 20260613000000_error_events_authenticated_select.sql
-- T6(c) #2 (§1.1 승인 2026-06-13): error_events 본인 trace SELECT 정책 추가.
--
-- 배경: 0016 은 RLS enable + 정책 0(service_role 전용), 0030 은 authenticated INSERT 만
-- 허용해 사용자가 자기 trace 를 읽을 수단이 없었다. owner-scope SELECT 를 추가한다.
-- anon 은 authenticated 한정이라 여전히 0 rows, service_role 은 RLS bypass 로 영향 없음.
-- read-only 노출만 추가 — INSERT/UPDATE/DELETE 권한은 부여하지 않는다.

create policy "error_events authenticated select own"
  on public.error_events
  for select
  to authenticated
  using (user_id = auth.uid());
