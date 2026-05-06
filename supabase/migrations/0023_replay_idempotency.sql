-- supabase/migrations/0023_replay_idempotency.sql
-- hapcard_replays 에 jinjin_date 컬럼 추가 + idempotency UNIQUE constraint
-- D3=무제한 결정에 따라 rate-limit 없음. 동일 (hapcard_id, jinjin_date) 중복 차감만 방지.
alter table public.hapcard_replays
  add column jinjin_date date not null default current_date;

-- default 제거 (이후 INSERT는 반드시 명시)
alter table public.hapcard_replays
  alter column jinjin_date drop default;

-- idempotency constraint: 같은 날(일진) 같은 hapcard 재호출 시 첫 결과 재사용
alter table public.hapcard_replays
  add constraint hapcard_replays_idempotency unique (hapcard_id, jinjin_date);

create index on public.hapcard_replays (hapcard_id, jinjin_date);
