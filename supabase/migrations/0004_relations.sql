-- supabase/migrations/0004_relations.sql
create table public.relations (
  relation_id      uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  nickname         text    not null,                               -- ADR-011: 별명만
  mode             text    not null check (mode in (
                     '일합', '친구합', '돈합', '첫합', '썸합', '오래합'
                   )),
  birth_date       date    not null,
  birth_date_calendar text not null check (birth_date_calendar in ('solar', 'lunar')),
  is_lunar_leap    boolean not null default false,
  birth_time_knowledge text not null check (birth_time_knowledge in ('exact', 'approximate', 'unknown')),
  birth_time       time,
  birth_longitude  numeric(7,4),                                   -- Expert Mode 경도 보정용만
  gender           text    not null check (gender in ('M', 'F')),
  consent_confirmed boolean not null default false,                -- 인연 동의 확인
  is_primary       boolean not null default false,                 -- todayHap 기본 대상
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.relations (user_id);
create index on public.relations (user_id, mode);

alter table public.relations enable row level security;
create policy "relations_own" on public.relations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
