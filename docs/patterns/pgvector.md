# pgvector.md — pgvector RAG 설정 패턴

> **용도**: knowledge_assets 테이블 고전 원문 임베딩 + 유사도 검색

---

## 1. 확장 활성화

```sql
-- Supabase에서 기본 포함됨 (별도 설치 불필요)
create extension if not exists "vector";
```

---

## 2. VECTOR 컬럼 및 인덱스

```sql
-- knowledge_assets 테이블 (db_schema.md §13 참조)
ALTER TABLE public.knowledge_assets
  ADD COLUMN embedding vector(1536);  -- OpenAI text-embedding-ada-002 차원

-- 인덱스 선택 기준:
-- < 100건: Sequential Scan (인덱스 불필요, Phase 0 MVP)
-- < 1,000건: IVFFlat
-- >= 1,000건: HNSW (권장)

-- Phase 0 MVP (20건): 인덱스 생략 가능
-- Phase 1 이후 (50건+): IVFFlat
CREATE INDEX ON public.knowledge_assets USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);  -- sqrt(rows) 권장

-- Phase 3 (100건+): HNSW
CREATE INDEX ON public.knowledge_assets USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 3. 임베딩 생성 (Supabase Edge Function)

```typescript
// supabase/functions/embed-asset/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  const { asset_id, text } = await req.json();

  // OpenAI Embeddings API
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  const { data } = await embeddingResponse.json();
  const embedding = data[0].embedding;  // number[] (1536차원)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  await supabase
    .from('knowledge_assets')
    .update({ embedding })
    .eq('asset_id', asset_id);

  return new Response(JSON.stringify({ success: true }));
});
```

---

## 4. 유사도 검색 (RAG 쿼리)

```typescript
// src/lib/rag/search.ts
export async function searchClassicAssets(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  threshold = 0.75,
  limit = 3
): Promise<KnowledgeCitation[]> {
  const { data } = await supabase.rpc('match_knowledge_assets', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  });

  return data ?? [];
}
```

```sql
-- Supabase RPC 함수
CREATE OR REPLACE FUNCTION match_knowledge_assets(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  asset_id text,
  asset_type text,
  topic_tags text[],
  content jsonb,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    asset_id,
    asset_type,
    topic_tags,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.knowledge_assets
  WHERE
    review_status IN ('approved_ai_and_crowd', 'approved_ai_crowd_and_beta')
    AND asset_type = 'classic'
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## 5. 유사도 임계값 가이드

| 임계값 | 의미 | 처리 |
|---|---|---|
| > 0.75 | 고관련 | classic_citation 섹션 포함 |
| 0.60~0.75 | 관련 있음 | 모드에 따라 선택적 포함 |
| < 0.60 | 관련 없음 | classic_citation 섹션 생략 (`RAG_CLASSIC_MISS`) |
