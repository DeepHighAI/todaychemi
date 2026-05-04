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
}

const APPROVED_STATUSES = [
  'approved_ai_pending_human',
  'approved_ai_and_crowd',
  'approved_ai_crowd_and_beta',
];

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
    match_count: topK,
    filter_statuses: APPROVED_STATUSES,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((r) => r.similarity >= optionalThreshold);

  return rows
    .sort((a, b) => b.similarity - a.similarity)
    .map((r) => ({
      asset_id: r.asset_id,
      source_title: r.source_title,
      source_chapter: r.source_chapter,
      original_text: r.original_text,
      original_reading: r.original_reading,
      modern_translation: r.modern_translation,
      topic_tags: r.topic_tags,
      similarity: r.similarity,
      tier: r.similarity >= requiredThreshold ? 'required' : 'optional',
    }));
}
