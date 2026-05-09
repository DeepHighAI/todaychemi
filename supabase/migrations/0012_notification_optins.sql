-- supabase/migrations/0012_notification_optins.sql
create table public.notification_optins (
  user_id        uuid    primary key references public.users(user_id) on delete cascade,
  daily_hap      boolean not null default true,
  hapcard_ready  boolean not null default true,
  marketing      boolean not null default false,
  updated_at     timestamptz not null default now()
);

alter table public.notification_optins enable row level security;
create policy "notif_optins_own" on public.notification_optins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
