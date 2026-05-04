import { retryOnce } from '@/lib/llm/retry';

interface EmbeddingCreateResult {
  data: Array<{ embedding: number[] }>;
}

export interface EmbedQueryDeps {
  embeddings: {
    create(params: { model: string; input: string }): Promise<EmbeddingCreateResult>;
  };
}

const EXPECTED_DIM = 1536;
const MODEL = 'text-embedding-3-small';

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 429 || (typeof status === 'number' && status >= 500 && status < 600);
}

export async function embedQuery(text: string, deps: EmbedQueryDeps): Promise<number[]> {
  if (!text) throw new Error('EMPTY_QUERY');

  const response = await retryOnce(
    () => deps.embeddings.create({ model: MODEL, input: text }),
    { isRetryable },
  );

  const vec = response.data[0].embedding;
  if (vec.length !== EXPECTED_DIM) {
    throw new Error(`EMBEDDING_DIM_MISMATCH: expected ${EXPECTED_DIM}, got ${vec.length}`);
  }
  return vec;
}
