-- supabase/migrations/0010_payments.sql
create table public.payments (
  payment_id       uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  toss_payment_key text    not null unique,
  toss_order_id    text    not null unique,
  amount_krw       int     not null,
  token_amount     int     not null,
  status           text    not null check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index on public.payments (user_id, created_at desc);
create index on public.payments (toss_order_id);

alter table public.payments enable row level security;
create policy "payments_own_read" on public.payments for select using (auth.uid() = user_id);
-- insert/update는 service_role 전용 (webhook)
