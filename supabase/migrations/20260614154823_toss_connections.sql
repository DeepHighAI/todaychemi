-- 20260614154823_toss_connections.sql
-- P3 앱인토스 Auth Bridge (Option A): toss_connections 테이블.
--
-- toss_connections: Toss userKey(앱 스코프 숫자) ↔ Supabase auth.users(uuid) 1:1 매핑.
-- 쓰기는 서비스 롤 전용, 읽기는 본인 행만 허용(RLS owner-scoped SELECT).
--
-- NOT YET APPLIED — apply via db:push at deploy time (see migration-before-deploy rule).
-- Wire into migrations manifest + RLS integration test WHEN applied.

create table if not exists public.toss_connections (
  id            uuid primary key default gen_random_uuid(),
  toss_user_key bigint not null,
  user_id       uuid   not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),

  constraint toss_connections_user_key_unique unique (toss_user_key)
);

-- 서비스 롤이 user_id 로 조회할 때 seq scan 방지
create index if not exists toss_connections_user_id_idx
  on public.toss_connections (user_id);

-- RLS 활성화 — 기본 deny-all
alter table public.toss_connections enable row level security;

-- SELECT: 본인 행만 조회 가능(옵셔널 — 미니앱 클라이언트가 직접 조회할 일은 없지만 방어적 허용)
create policy "owner can select own toss_connection"
  on public.toss_connections
  for select
  using (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE: 서비스 롤만 허용 — 클라이언트 직접 쓰기 금지.
-- RLS 에 서비스 롤 bypass 정책 없음 → 서비스 롤 클라이언트는 RLS 를 우회함(supabase default).
