-- Relation slot registration billing (ADR-039 Amended 2026-06-10).
-- 인연 등록 슬롯 과금(모델 B): 인연 2명까지 무료, 3번째부터 ₩1,000/10부적(하이브리드).
-- 현금 결제는 비동기(토스 리다이렉트)이므로 인연 초안을 별도 테이블에 스테이징한 뒤
-- 결제 성공(confirm) 시 머티리얼라이즈한다. relations 테이블은 깨끗하게 유지되어
-- feed/today 등 읽기 사이트는 status 필터 변경이 전혀 없다.

-- 1. 인연 초안 스테이징 테이블
--    materialized_at = 멱등 마커. 머티리얼라이즈 후에도 행을 삭제하지 않는다
--    (confirm 재진입 시 ref 소유 검증이 통과해야 하므로 삭제 금지, 마킹만).
create table public.pending_relation_registrations (
  pending_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  draft jsonb not null,
  relation_id uuid references public.relations(relation_id) on delete set null,
  materialized_at timestamptz,
  created_at timestamptz not null default now()
);

create index pending_relation_registrations_user_created_idx
  on public.pending_relation_registrations (user_id, created_at desc);

alter table public.pending_relation_registrations enable row level security;

create policy "pending_relation_registrations_own"
  on public.pending_relation_registrations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. payments.feature_id CHECK 확장 — 'relation_slot' 추가
--    (20260601000000 의 인라인 컬럼 CHECK 는 payments_feature_id_check 로 자동 명명됨)
alter table public.payments
  drop constraint if exists payments_feature_id_check;

alter table public.payments
  add constraint payments_feature_id_check
    check (feature_id is null or feature_id in ('hapcard', 'whatif', 'replay', 'relation_slot'));

-- 3. token_ledger 멱등 부분 유니크 인덱스 — relation_slot reason 추가
--    (인덱스 predicate 는 ALTER 불가 — drop 후 재생성. 기존 행은 구 reason 만 보유라 충돌 없음)
drop index if exists public.token_ledger_feature_spend_reference_uidx;

create unique index token_ledger_feature_spend_reference_uidx
  on public.token_ledger (user_id, reason, reference_id)
  where reference_id is not null
    and reason in ('hapcard_use', 'replay_use', 'whatif_use', 'relation_slot_use');

drop index if exists public.token_ledger_feature_refund_reference_uidx;

create unique index token_ledger_feature_refund_reference_uidx
  on public.token_ledger (user_id, reason, reference_id)
  where reference_id is not null
    and reason in ('hapcard_refund', 'replay_refund', 'whatif_refund', 'relation_slot_refund');

-- 4. deduct_tokens_once / refund_tokens_once 재선언 — reason IN-list 에 relation_slot 추가
--    (본문은 20260531031246 verbatim, IN-list 리터럴만 확장. 누락 시 사전 멱등 체크와
--     unique_violation fallback 이 모두 비활성화되어 더블탭 이중과금이 된다.)
create or replace function public.deduct_tokens_once(
  uid uuid,
  delta int,
  reason text,
  ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance int;
  new_balance int;
  existing_balance int;
begin
  if $2 >= 0 then
    raise exception 'DEDUCT_DELTA_MUST_BE_NEGATIVE' using errcode = 'P0001';
  end if;

  if $4 is not null and $3 in ('hapcard_use', 'replay_use', 'whatif_use', 'relation_slot_use') then
    select t.balance_after
      into existing_balance
      from public.token_ledger t
     where t.user_id = $1
       and t.reason = $3
       and t.reference_id = $4
     order by t.created_at asc
     limit 1;

    if found then
      return jsonb_build_object('balance_after', existing_balance, 'inserted', false);
    end if;
  end if;

  select coalesce(sum(t.delta), 0)
    into current_balance
    from public.token_ledger t
   where t.user_id = $1;

  new_balance := current_balance + $2;

  if new_balance < 0 then
    raise exception 'INSUFFICIENT_TOKENS' using errcode = 'P0001';
  end if;

  begin
    insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
    values ($1, $2, $3, $4, new_balance);
  exception when unique_violation then
    select t.balance_after
      into existing_balance
      from public.token_ledger t
     where t.user_id = $1
       and t.reason = $3
       and t.reference_id = $4
     order by t.created_at asc
     limit 1;

    if found then
      return jsonb_build_object('balance_after', existing_balance, 'inserted', false);
    end if;

    raise;
  end;

  return jsonb_build_object('balance_after', new_balance, 'inserted', true);
end $$;

create or replace function public.refund_tokens_once(
  uid uuid,
  delta int,
  reason text,
  ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance int;
  new_balance int;
  existing_balance int;
begin
  if $2 <= 0 then
    raise exception 'REFUND_DELTA_MUST_BE_POSITIVE' using errcode = 'P0001';
  end if;

  if $4 is not null and $3 in ('hapcard_refund', 'replay_refund', 'whatif_refund', 'relation_slot_refund') then
    select t.balance_after
      into existing_balance
      from public.token_ledger t
     where t.user_id = $1
       and t.reason = $3
       and t.reference_id = $4
     order by t.created_at asc
     limit 1;

    if found then
      return jsonb_build_object('balance_after', existing_balance, 'inserted', false);
    end if;
  end if;

  select coalesce(sum(t.delta), 0)
    into current_balance
    from public.token_ledger t
   where t.user_id = $1;

  new_balance := current_balance + $2;

  begin
    insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
    values ($1, $2, $3, $4, new_balance);
  exception when unique_violation then
    select t.balance_after
      into existing_balance
      from public.token_ledger t
     where t.user_id = $1
       and t.reason = $3
       and t.reference_id = $4
     order by t.created_at asc
     limit 1;

    if found then
      return jsonb_build_object('balance_after', existing_balance, 'inserted', false);
    end if;

    raise;
  end;

  return jsonb_build_object('balance_after', new_balance, 'inserted', true);
end $$;

revoke all on function public.deduct_tokens_once(uuid, integer, text, text) from public;
revoke execute on function public.deduct_tokens_once(uuid, integer, text, text) from anon;
revoke execute on function public.deduct_tokens_once(uuid, integer, text, text) from authenticated;
grant execute on function public.deduct_tokens_once(uuid, integer, text, text) to service_role;

revoke all on function public.refund_tokens_once(uuid, integer, text, text) from public;
revoke execute on function public.refund_tokens_once(uuid, integer, text, text) from anon;
revoke execute on function public.refund_tokens_once(uuid, integer, text, text) from authenticated;
grant execute on function public.refund_tokens_once(uuid, integer, text, text) to service_role;
