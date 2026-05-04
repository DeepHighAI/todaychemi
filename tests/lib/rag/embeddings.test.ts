import { describe, it, expect, vi } from 'vitest';
import { embedQuery } from '@/lib/rag/embeddings';

const DUMMY_VEC = Array.from({ length: 1536 }, (_, i) => i * 0.001);

function makeMockOpenAI(responses: Array<{ success: boolean; data?: number[]; status?: number }>) {
  let callCount = 0;
  return {
    embeddings: {
      create: vi.fn(async () => {
        const resp = responses[callCount++];
        if (!resp.success) {
          const err = new Error(`HTTP error ${resp.status}`);
          (err as NodeJS.ErrnoException & { status?: number }).status = resp.status;
          throw err;
        }
        return { data: [{ embedding: resp.data ?? DUMMY_VEC }] };
      }),
    },
  };
}

describe('embedQuery — text-embedding-3-small wrapper', () => {
  it('1차 성공 → 1536-dim 배열 반환', async () => {
    const deps = makeMockOpenAI([{ success: true }]);
    const result = await embedQuery('갑목 일간', deps);
    expect(result).toHaveLength(1536);
    expect(deps.embeddings.create).toHaveBeenCalledTimes(1);
    expect(deps.embeddings.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'text-embedding-3-small' }),
    );
  });

  it('1차 429 + 2차 성공 → 재시도 후 결과 반환', async () => {
    const deps = makeMockOpenAI([
      { success: false, status: 429 },
      { success: true },
    ]);
    const result = await embedQuery('test', deps);
    expect(result).toHaveLength(1536);
    expect(deps.embeddings.create).toHaveBeenCalledTimes(2);
  });

  it('1차 500 + 2차 성공 → 재시도 동작', async () => {
    const deps = makeMockOpenAI([
      { success: false, status: 500 },
      { success: true },
    ]);
    const result = await embedQuery('test', deps);
    expect(result).toHaveLength(1536);
    expect(deps.embeddings.create).toHaveBeenCalledTimes(2);
  });

  it('1차 401 (auth) → 즉시 throw (재시도 없음)', async () => {
    const deps = makeMockOpenAI([{ success: false, status: 401 }]);
    await expect(embedQuery('test', deps)).rejects.toThrow();
    expect(deps.embeddings.create).toHaveBeenCalledTimes(1);
  });

  it('응답 dim != 1536 → EMBEDDING_DIM_MISMATCH throw', async () => {
    const shortVec = [0.1, 0.2, 0.3];
    const deps = makeMockOpenAI([{ success: true, data: shortVec }]);
    await expect(embedQuery('test', deps)).rejects.toThrow('EMBEDDING_DIM_MISMATCH');
  });

  it('빈 문자열 → EMPTY_QUERY throw (openai 호출 없음)', async () => {
    const deps = makeMockOpenAI([]);
    await expect(embedQuery('', deps)).rejects.toThrow('EMPTY_QUERY');
    expect(deps.embeddings.create).not.toHaveBeenCalled();
  });
});
