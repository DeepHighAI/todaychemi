-- Pay-per-use feature billing (ADR-039).
-- 부적 충전(토큰 번들 구매)을 제거하고, 유료 기능(합카드·만약합·다시합)을 사용 시점에
-- 즉시 결제하는 모델로 전환한다. payments 테이블이 토큰충전(legacy)과 피처사용을 함께 표현한다.
-- 결제 확정은 토큰을 적립하지 않는다 — payments.feature_ref(=cacheKey) 가 잠금해제 레코드.

-- 1. payments: 토큰충전(레거시) vs 피처사용 구분
alter table public.payments
  add column if not exists charge_type text not null default 'token_charge'
    check (charge_type in ('token_charge', 'feature_use')),
  add column if not exists feature_id text
    check (feature_id is null or feature_id in ('hapcard', 'whatif', 'replay')),
  add column if not exists feature_ref text;

-- 피처사용 row 는 토큰을 적립하지 않으므로 token_amount 를 nullable 로 푼다.
alter table public.payments
  alter column token_amount drop not null;

-- feature_use 는 feature_id+feature_ref 를 반드시 갖고 product_id 는 없어야 한다. token_charge 는 그 반대.
alter table public.payments
  add constraint payments_feature_use_shape check (
    (charge_type = 'feature_use' and feature_id is not null and feature_ref is not null and product_id is null)
    or
    (charge_type = 'token_charge' and feature_id is null and feature_ref is null)
  );

-- 동일 (user, feature, ref) 에 대해 열린 주문(pending/confirmed)은 하나만 — 실결제 중복 청구 방지.
create unique index if not exists payments_feature_open_uidx
  on public.payments (user_id, feature_id, feature_ref)
  where charge_type = 'feature_use' and status in ('pending', 'confirmed');

-- 2. confirm_feature_payment: 결제확정만(토큰 적립 없음). 멱등.
create or replace function public.confirm_feature_payment(
  uid uuid,
  p_toss_order_id text,
  p_toss_payment_key text,
  p_feature_id text,
  p_feature_ref text,
  p_amount_krw int,
  p_receipt_url text default null,
  p_confirmed_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
begin
  select *
    into payment_row
    from public.payments
   where user_id = uid
     and toss_order_id = p_toss_order_id
   for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 멱등: 이미 확정된 주문은 다시 확정하지 않는다.
  if payment_row.status = 'confirmed' then
    return 'already_confirmed';
  end if;

  if payment_row.status not in ('pending', 'failed') then
    raise exception 'PAYMENT_NOT_CONFIRMABLE' using errcode = 'P0001';
  end if;

  if payment_row.charge_type <> 'feature_use'
     or payment_row.feature_id is distinct from p_feature_id
     or payment_row.feature_ref is distinct from p_feature_ref then
    raise exception 'PAYMENT_FEATURE_MISMATCH' using errcode = 'P0001';
  end if;

  if payment_row.amount_krw <> p_amount_krw then
    raise exception 'PAYMENT_AMOUNT_MISMATCH' using errcode = 'P0001';
  end if;

  update public.payments
     set toss_payment_key = p_toss_payment_key,
         status = 'confirmed',
         confirmed_at = p_confirmed_at,
         receipt_url = p_receipt_url,
         failure_code = null,
         failure_message = null,
         updated_at = now()
   where payment_id = payment_row.payment_id;

  return 'confirmed';
end $$;

revoke all on function public.confirm_feature_payment(uuid, text, text, text, text, int, text, timestamptz) from public, anon, authenticated;
grant execute on function public.confirm_feature_payment(uuid, text, text, text, text, int, text, timestamptz) to service_role;

-- 3. 레거시 토큰충전 RPC 제거 (부적은 더 이상 구매하지 않는다).
drop function if exists public.confirm_token_purchase(uuid, text, text, text, int, int, text, timestamptz);
