-- Token spend/refund idempotency for paid launch features.
-- - hapcard create: 8 tokens
-- - replay: 4 tokens (existing route)
-- - whatif: 5 tokens
--
-- The route handlers use the *_once RPCs for feature cache keys so retry,
-- duplicate redirect, or double-click requests cannot write duplicate ledger rows.

create unique index if not exists token_ledger_feature_spend_reference_uidx
  on public.token_ledger (user_id, reason, reference_id)
  where reference_id is not null
    and reason in ('hapcard_use', 'replay_use', 'whatif_use');

create unique index if not exists token_ledger_feature_refund_reference_uidx
  on public.token_ledger (user_id, reason, reference_id)
  where reference_id is not null
    and reason in ('hapcard_refund', 'replay_refund', 'whatif_refund');

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

  if $4 is not null and $3 in ('hapcard_use', 'replay_use', 'whatif_use') then
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

  if $4 is not null and $3 in ('hapcard_refund', 'replay_refund', 'whatif_refund') then
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
