-- supabase/migrations/0014_knowledge_assets.sql
create table public.knowledge_assets (
  asset_id      text    primary key,
  asset_type    text    not null check (asset_type in (
                  'classic', 'concept_dict', 'modern_translation', 'safety_rule'
                )),
  domain        text,
  topic_tags    text[]  not null default '{}',
  content       jsonb   not null,
  embedding     vector(1536),
  share_card_url text,
  version       text    not null,
  review_status text    not null check (review_status in (
                  'draft',
                  'approved_ai_pending_human',
                  'approved_ai_and_crowd',
                  'approved_ai_crowd_and_beta',
                  'deprecated'
                )),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.knowledge_assets using hnsw (embedding vector_cosine_ops);
create index on public.knowledge_assets (asset_type, review_status);
create index on public.knowledge_assets using gin (topic_tags);

alter table public.knowledge_assets enable row level security;
create policy "knowledge_assets_public_read" on public.knowledge_assets
  for select using (true);
-- write는 service_role 전용
