-- supabase/migrations/0021_classics.sql
-- F4 Q4: pgvector classics table for RAG classic citations
create table public.classics (
  asset_id            text    primary key,
  source_title        text    not null,
  source_chapter      text    not null,
  original_text       text    not null,
  original_reading    text,
  modern_translation  text    not null,
  topic_tags          text[]  not null default '{}',
  embedding           vector(1536),
  version             text    not null,
  review_status       text    not null check (review_status in (
                        'draft',
                        'approved_ai_pending_human',
                        'approved_ai_and_crowd',
                        'approved_ai_crowd_and_beta',
                        'deprecated'
                      )),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on public.classics using hnsw (embedding vector_cosine_ops);
create index on public.classics (review_status);
create index on public.classics using gin (topic_tags);

alter table public.classics enable row level security;
create policy "classics_public_read" on public.classics
  for select using (true);
-- write is service_role only.
