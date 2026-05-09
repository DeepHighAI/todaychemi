-- supabase/migrations/0011_push_subscriptions.sql
create table public.push_subscriptions (
  subscription_id uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references public.users(user_id) on delete cascade,
  fcm_token       text    not null,
  device_type     text    not null check (device_type in ('android', 'ios', 'web')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.push_subscriptions (user_id, is_active);

alter table public.push_subscriptions enable row level security;
create policy "push_subs_own" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
