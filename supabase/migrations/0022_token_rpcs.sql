-- supabase/migrations/0022_token_rpcs.sql
-- deduct_tokens: 잔액 확인 후 차감. 부족 시 INSUFFICIENT_TOKENS exception 발생
create or replace function public.deduct_tokens(
  uid         uuid,
  delta       int,           -- 음수 (예: -4)
  reason      text,
  ref         text default null
)
returns int  -- balance_after
language plpgsql security definer as $$
declare
  current_balance int;
  new_balance     int;
begin
  select coalesce(sum(t.delta), 0)
    into current_balance
    from public.token_ledger t
   where t.user_id = uid;

  new_balance := current_balance + delta;

  if new_balance < 0 then
    raise exception 'INSUFFICIENT_TOKENS' using errcode = 'P0001';
  end if;

  insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
  values (uid, delta, reason, ref, new_balance);

  return new_balance;
end $$;

-- refund_tokens: 보상 환불 (항상 성공)
create or replace function public.refund_tokens(
  uid         uuid,
  delta       int,           -- 양수 (예: +4)
  reason      text,
  ref         text default null
)
returns int  -- balance_after
language plpgsql security definer as $$
declare
  current_balance int;
  new_balance     int;
begin
  select coalesce(sum(t.delta), 0)
    into current_balance
    from public.token_ledger t
   where t.user_id = uid;

  new_balance := current_balance + delta;

  insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
  values (uid, delta, reason, ref, new_balance);

  return new_balance;
end $$;
