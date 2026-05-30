-- TossPayments V2 token charge hardening.
-- Adds server-persisted customer keys, tamper/invalid statuses, and duplicate grant protection.

alter table public.payments
  add column if not exists toss_customer_key text;

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'confirmed', 'failed', 'refunded', 'tampered', 'invalid'));

alter table public.payments
  drop constraint if exists payments_toss_order_id_format_check;

alter table public.payments
  add constraint payments_toss_order_id_format_check
  check (toss_order_id ~ '^[A-Za-z0-9_-]{6,64}$');

alter table public.payments
  drop constraint if exists payments_toss_customer_key_format_check;

alter table public.payments
  add constraint payments_toss_customer_key_format_check
  check (
    toss_customer_key is null
    or (
      char_length(toss_customer_key) between 2 and 300
      and toss_customer_key ~ '^[A-Za-z0-9_=.@-]+$'
      and toss_customer_key ~ '[-_=.@]'
    )
  );

create unique index if not exists token_ledger_purchase_reference_unique_idx
  on public.token_ledger (user_id, reason, reference_id)
  where reason = 'purchase' and reference_id is not null;
