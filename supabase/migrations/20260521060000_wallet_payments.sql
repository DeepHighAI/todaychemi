-- Wallet + TossPayments V2 checkout support.
-- Keeps the existing token_ledger/payments model and makes payments usable for pending orders.

alter table public.payments
  alter column toss_payment_key drop not null;

alter table public.payments
  add column if not exists product_id text,
  add column if not exists failure_code text,
  add column if not exists failure_message text,
  add column if not exists receipt_url text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists payments_user_status_created_idx
  on public.payments (user_id, status, created_at desc);

create index if not exists token_ledger_user_reason_created_idx
  on public.token_ledger (user_id, reason, created_at desc);

create or replace function public.confirm_token_purchase(
  uid uuid,
  p_toss_order_id text,
  p_toss_payment_key text,
  p_product_id text,
  p_amount_krw int,
  p_token_amount int,
  p_receipt_url text default null,
  p_confirmed_at timestamptz default now()
)
returns int
language plpgsql
security definer
as $$
declare
  payment_row public.payments%rowtype;
  current_balance int;
  new_balance int;
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

  if payment_row.status = 'confirmed' then
    select coalesce(max(balance_after), 0)
      into new_balance
      from public.token_ledger
     where user_id = uid
       and reason = 'purchase'
       and reference_id = payment_row.payment_id::text;

    if new_balance = 0 then
      select coalesce(sum(delta), 0)
        into new_balance
        from public.token_ledger
       where user_id = uid;
    end if;

    return new_balance;
  end if;

  if payment_row.status not in ('pending', 'failed') then
    raise exception 'PAYMENT_NOT_CONFIRMABLE' using errcode = 'P0001';
  end if;

  if payment_row.product_id is not null and payment_row.product_id <> p_product_id then
    raise exception 'PRODUCT_MISMATCH' using errcode = 'P0001';
  end if;

  if payment_row.amount_krw <> p_amount_krw or payment_row.token_amount <> p_token_amount then
    raise exception 'PAYMENT_AMOUNT_MISMATCH' using errcode = 'P0001';
  end if;

  select coalesce(sum(delta), 0)
    into current_balance
    from public.token_ledger
   where user_id = uid;

  new_balance := current_balance + p_token_amount;

  update public.payments
     set toss_payment_key = p_toss_payment_key,
         product_id = p_product_id,
         status = 'confirmed',
         confirmed_at = p_confirmed_at,
         receipt_url = p_receipt_url,
         failure_code = null,
         failure_message = null,
         updated_at = now()
   where payment_id = payment_row.payment_id;

  insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
  values (uid, p_token_amount, 'purchase', payment_row.payment_id::text, new_balance);

  return new_balance;
end $$;
