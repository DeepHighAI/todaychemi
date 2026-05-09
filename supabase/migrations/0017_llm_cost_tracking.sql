-- supabase/migrations/0017_llm_cost_tracking.sql
create table public.llm_cost_tracking (
  date        date    not null,
  provider    text    not null check (provider in ('openai', 'anthropic')),
  model       text    not null,
  total_usd   numeric(10,4) not null default 0,
  call_count  int     not null default 0,
  token_in    bigint  not null default 0,
  token_out   bigint  not null default 0,
  primary key (date, provider, model)
);

alter table public.llm_cost_tracking enable row level security;
-- RLS enabled, no policies (service_role only)
