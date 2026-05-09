-- supabase/migrations/0019_feedback_events.sql
create table public.feedback_events (
  event_id          uuid    primary key default gen_random_uuid(),
  user_id           uuid    not null references public.users(user_id) on delete cascade,
  target_type       text    not null check (target_type in (
                      'hapcard', 'hapcard_replay', 'daily_hap', 'knowledge_asset'
                    )),
  target_id         text    not null,
  signal            text    not null check (signal in ('thumbs_up', 'thumbs_down', 'inspect')),
  quality_issue_flag text   check (quality_issue_flag in (
                      'generic', 'vague', 'wrong_context', 'classic_translation', 'other'
                    )),
  quality_issue_note text,
  created_at        timestamptz not null default now()
);

create index on public.feedback_events (target_type, target_id);
create index on public.feedback_events (user_id, created_at desc);
create index on public.feedback_events (signal, created_at desc);

alter table public.feedback_events enable row level security;
create policy "feedback_own_insert" on public.feedback_events
  for insert with check (auth.uid() = user_id);
create policy "feedback_own_read" on public.feedback_events
  for select using (auth.uid() = user_id);
