-- supabase/migrations/0002_users.sql
create table public.users (
  user_id          uuid        primary key references auth.users(id) on delete cascade,
  nickname         text        not null,
  birth_date       date        not null,
  birth_date_calendar text     not null check (birth_date_calendar in ('solar', 'lunar')),
  is_lunar_leap    boolean     not null default false,
  birth_time_knowledge text    not null check (birth_time_knowledge in ('exact', 'approximate', 'unknown')),
  birth_time       time,
  birth_time_range_from time,
  birth_time_range_to   time,
  gender           text        not null check (gender in ('M', 'F')),
  -- 개인정보 동의
  consented_at     timestamptz not null default now(),
  consented_tos_version text   not null,
  age_confirmed    boolean     not null default false,
  -- 온보딩
  first_result_viewed_at timestamptz,
  -- 계정 관리
  deletion_requested_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.users (user_id);

alter table public.users enable row level security;
create policy "users_self_read"   on public.users for select using (auth.uid() = user_id);
create policy "users_self_insert" on public.users for insert with check (auth.uid() = user_id);
create policy "users_self_update" on public.users for update using (auth.uid() = user_id);
