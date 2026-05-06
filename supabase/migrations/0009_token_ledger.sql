-- supabase/migrations/0009_token_ledger.sql
create table public.token_ledger (
  ledger_id    uuid    primary key default gen_random_uuid(),
  user_id      uuid    not null references public.users(user_id) on delete cascade,
  delta        int     not null,            -- ?�수=충전, ?�수=차감
  reason       text    not null,            -- 'purchase' | 'hapcard_use' | 'replay_use' | 'replay_refund' | 'refund' | 'bonus'
  reference_id text,                        -- payment_id ?�는 hapcard_id
  balance_after int    not null,
  created_at   timestamptz not null default now()
);

create index on public.token_ledger (user_id, created_at desc);

alter table public.token_ledger enable row level security;
create policy "ledger_own_read" on public.token_ledger for select using (auth.uid() = user_id);
-- insert??service_role ?�용
