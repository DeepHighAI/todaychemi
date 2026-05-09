-- supabase/migrations/0015_banned_phrase_hits.sql
create table public.banned_phrase_hits (
  hit_id         uuid    primary key default gen_random_uuid(),
  prompt_version text    not null,
  phrase_category text   not null,
  phrase_matched text    not null,
  hapcard_id     uuid    references public.hapcards(hapcard_id) on delete set null,
  created_at     timestamptz not null default now()
);

create index on public.banned_phrase_hits (prompt_version, created_at desc);
create index on public.banned_phrase_hits (phrase_category);

alter table public.banned_phrase_hits enable row level security;
-- RLS enabled, no policies (service_role only)
