-- supabase/migrations/0027_match_classics_fn.sql
-- F4: pgvector cosine-similarity search function for RAG classic citations
-- Called by src/lib/rag/classics.ts retrieveClassics()
create or replace function public.match_classics(
  query_embedding vector(1536),
  match_count     int,
  filter_statuses text[]
)
returns table (
  asset_id           text,
  source_title       text,
  source_chapter     text,
  original_text      text,
  original_reading   text,
  modern_translation text,
  topic_tags         text[],
  similarity         float
)
language sql stable
security definer
as $$
  select
    c.asset_id,
    c.source_title,
    c.source_chapter,
    c.original_text,
    c.original_reading,
    c.modern_translation,
    c.topic_tags,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.classics c
  where c.review_status = any(filter_statuses)
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
