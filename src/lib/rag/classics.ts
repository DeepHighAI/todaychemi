import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClassicHit {
  asset_id: string;
  source_title: string;
  source_chapter: string;
  original_text: string;
  original_reading: string | null;
  modern_translation: string;
  topic_tags: string[];
  similarity: number;
  tier: 'required' | 'optional';
}

export interface RetrieveClassicsOptions {
  topK?: number;
  requiredThreshold?: number;
  optionalThreshold?: number;
  // ISSUE-001 (§1.1 결정 ③): topic_tags lexical 직매칭 — 단문 임베딩 쿼리의
  // 임계 미달(실측 max ~0.35 < 0.60)을 우회. 미전달 시 기존 임베딩 전용 동작.
  queryTags?: string[];
}

const APPROVED_STATUSES = [
  'approved_ai_pending_human',
  'approved_ai_and_crowd',
  'approved_ai_crowd_and_beta',
];

// lexical 채택 최소 겹침 — mode 태그(항상 1)만으로는 관련성 부족, mode+개념 1개 이상
const LEXICAL_MIN_OVERLAP = 2;
// queryTags 존재 시 RPC match_count 확장 — lexical hit 의 유사도(정렬 보조)를 확보.
// classics 테이블 규모(현재 34 rows)를 여유 있게 커버
const SIMILARITY_SCAN_COUNT = 50;

export async function retrieveClassics(
  client: SupabaseClient,
  queryEmbedding: number[],
  options: RetrieveClassicsOptions = {},
): Promise<ClassicHit[]> {
  if (queryEmbedding.length !== 1536) {
    throw new Error(`EMBEDDING_DIM_MISMATCH: expected 1536, got ${queryEmbedding.length}`);
  }

  const topK = options.topK ?? 5;
  const requiredThreshold = options.requiredThreshold ?? 0.75;
  const optionalThreshold = options.optionalThreshold ?? 0.60;
  const queryTags = options.queryTags ?? [];
  const useLexical = queryTags.length > 0;

  const { data, error } = await (client as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{
      data: Array<{
        asset_id: string;
        source_title: string;
        source_chapter: string;
        original_text: string;
        original_reading: string | null;
        modern_translation: string;
        topic_tags: string[];
        similarity: number;
      }> | null;
      error: { message: string } | null;
    }>;
  }).rpc('match_classics', {
    query_embedding: queryEmbedding,
    // lexical 사용 시 확장 스캔 — lexical hit 의 유사도를 정렬 보조로 확보
    match_count: useLexical ? SIMILARITY_SCAN_COUNT : topK,
    filter_statuses: APPROVED_STATUSES,
  });

  if (error) throw new Error(error.message);

  const embeddingRows = data ?? [];
  const similarityByAssetId = new Map(embeddingRows.map((r) => [r.asset_id, r.similarity]));

  // 후보 1: 임베딩 임계 통과 (기존 동작 유지)
  type CandidateRow = Omit<(typeof embeddingRows)[number], 'similarity'>;
  const candidates = new Map<string, CandidateRow>();
  for (const r of embeddingRows) {
    if (r.similarity >= optionalThreshold) candidates.set(r.asset_id, r);
  }

  // 후보 2: topic_tags lexical 직매칭 — 겹침 ≥ LEXICAL_MIN_OVERLAP 만 채택
  if (useLexical) {
    const lexical = await (client as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          overlaps: (col: string, tags: string[]) => {
            in: (col: string, statuses: string[]) => Promise<{
              data: CandidateRow[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    })
      .from('classics')
      .select(
        'asset_id, source_title, source_chapter, original_text, original_reading, modern_translation, topic_tags',
      )
      .overlaps('topic_tags', queryTags)
      .in('review_status', APPROVED_STATUSES);

    if (lexical.error) throw new Error(lexical.error.message);

    for (const r of lexical.data ?? []) {
      const overlap = r.topic_tags.filter((t) => queryTags.includes(t)).length;
      if (overlap >= LEXICAL_MIN_OVERLAP && !candidates.has(r.asset_id)) {
        candidates.set(r.asset_id, r);
      }
    }
  }

  const overlapOf = (r: CandidateRow) =>
    useLexical ? r.topic_tags.filter((t) => queryTags.includes(t)).length : 0;
  const similarityOf = (r: CandidateRow) => similarityByAssetId.get(r.asset_id) ?? 0;

  // 정렬: 태그 겹침 내림차순 → 유사도 내림차순 → asset_id 오름차순 (결정성)
  return [...candidates.values()]
    .sort((a, b) => {
      const byOverlap = overlapOf(b) - overlapOf(a);
      if (byOverlap !== 0) return byOverlap;
      const bySimilarity = similarityOf(b) - similarityOf(a);
      if (bySimilarity !== 0) return bySimilarity;
      return a.asset_id < b.asset_id ? -1 : 1;
    })
    .slice(0, topK)
    .map((r) => ({
      asset_id: r.asset_id,
      source_title: r.source_title,
      source_chapter: r.source_chapter,
      original_text: r.original_text,
      original_reading: r.original_reading,
      modern_translation: r.modern_translation,
      topic_tags: r.topic_tags,
      similarity: similarityOf(r),
      tier: similarityOf(r) >= requiredThreshold ? 'required' : 'optional',
    }));
}
