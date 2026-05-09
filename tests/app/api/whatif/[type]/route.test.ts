import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/whatif/builder');
vi.mock('@/lib/whatif/query-text');
vi.mock('@/lib/llm/clients');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { buildWhatif } from '@/lib/whatif/builder';
import { buildWhatifRagQueryText } from '@/lib/whatif/query-text';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import { POST } from '@/app/api/whatif/[type]/route';
import type { ChartCore } from '@/types/chart';
import type { WhatifResult } from '@/types/diagnostic';
import { MOCK_CHART_CORE, MOCK_CHART_HASH, MOCK_LLM_OUTPUT, MOCK_PROMPT_VERSION } from '../../../../fixtures/whatif';

const USER_ID = 'user-uuid-5678';
const CHART_ROW = { chart_core: MOCK_CHART_CORE, chart_hash: MOCK_CHART_HASH };

const WHATIF_RESULT: WhatifResult = {
  id: 'whatif-uuid-1234',
  user_id: USER_ID,
  type: 'work',
  content: MOCK_LLM_OUTPUT,
  prompt_version: MOCK_PROMPT_VERSION,
  llm_model: 'gpt-5o',
  cache_key: 'cachecachecachecachecachecachecachecachecachecachecachecachecach',
  chart_hash: MOCK_CHART_HASH,
  created_at: '2026-05-09T00:00:00Z',
};

// user_charts 쿼리 체인: .select().eq('user_id').order().limit().maybeSingle()
function makeAuthedClient(opts: {
  userId?: string | null;
  chartRow?: typeof CHART_ROW | null;
  chartError?: { message: string } | null;
}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.chartRow === undefined ? CHART_ROW : opts.chartRow,
    error: opts.chartError ?? null,
  });
  const limitChain = { maybeSingle };
  const orderChain = { limit: vi.fn().mockReturnValue(limitChain) };
  const eqChain = { order: vi.fn().mockReturnValue(orderChain) };
  const selectChain = { eq: vi.fn().mockReturnValue(eqChain) };
  const from = vi.fn((table: string) => {
    if (table === 'user_charts') return { select: vi.fn().mockReturnValue(selectChain) };
    return {};
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from,
    maybySingle: maybeSingle,
  };
}

function makeParams(type: string) {
  return { params: Promise.resolve({ type }) };
}

function makeRequest() {
  return new Request('http://localhost/api/whatif/work', {
    method: 'POST',
  }) as unknown as Parameters<typeof POST>[0];
}

const rpcFn = vi.fn();
const SERVICE_CLIENT = { from: vi.fn(), rpc: rpcFn };
const OPENAI_CLIENT = { chat: { completions: { create: vi.fn() } } };
const EMBEDDINGS_CLIENT = { create: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServiceRoleClient).mockReturnValue(SERVICE_CLIENT as never);
  vi.mocked(createOpenAiClient).mockReturnValue(OPENAI_CLIENT as never);
  vi.mocked(createEmbeddingsClient).mockReturnValue(EMBEDDINGS_CLIENT as never);
  vi.mocked(buildWhatifRagQueryText).mockReturnValue('work 일주 병인 일간 화');
  vi.mocked(buildWhatif).mockResolvedValue({ result: WHATIF_RESULT, fromCache: false } as never);
  rpcFn.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/whatif/[type]', () => {
  it('200 → WhatifResult JSON 반환 (성공 경로)', async () => {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(WHATIF_RESULT.id);
    expect(body.type).toBe('work');
  });

  it('400 INVALID_TYPE → path param 이 enum 외 값', async () => {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(), makeParams('unknown_type'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_TYPE');
    expect(buildWhatif).not.toHaveBeenCalled();
  });

  it('401 UNAUTHORIZED → 미인증', async () => {
    const supabase = makeAuthedClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(buildWhatif).not.toHaveBeenCalled();
  });

  it('404 USER_CHART_NOT_FOUND → user_charts 데이터 없음', async () => {
    const supabase = makeAuthedClient({ chartRow: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('USER_CHART_NOT_FOUND');
    expect(buildWhatif).not.toHaveBeenCalled();
  });

  it('500 INTERNAL_ERROR → user_charts lookup DB 에러', async () => {
    const supabase = makeAuthedClient({ chartError: { message: 'connection reset' } });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(buildWhatif).not.toHaveBeenCalled();
  });

  it('422 GROUNDING_FAILED → buildWhatif 가 GROUNDING_FAILED throw', async () => {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildWhatif).mockRejectedValue(new Error('GROUNDING_FAILED: []'));

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('GROUNDING_FAILED');
  });

  it('500 INTERNAL_ERROR → buildWhatif 가 WHATIF_INSERT_FAILED throw', async () => {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildWhatif).mockRejectedValue(new Error('WHATIF_INSERT_FAILED: db error'));

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('500 INTERNAL_ERROR → buildWhatif 가 generic error throw', async () => {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildWhatif).mockRejectedValue(new Error('unexpected crash'));

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('buildWhatif 호출 시 input.user_id, type, chart, chart_hash 정확히 전달', async () => {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    await POST(makeRequest(), makeParams('love'));

    expect(buildWhatif).toHaveBeenCalledTimes(1);
    const [input] = vi.mocked(buildWhatif).mock.calls[0];
    expect(input.user_id).toBe(USER_ID);
    expect(input.type).toBe('love');
    expect(input.chart).toEqual(MOCK_CHART_CORE);
    expect(input.chart_hash).toBe(MOCK_CHART_HASH);
  });

  it('buildWhatif deps — 5개 필드 모두 정확히 전달', async () => {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    await POST(makeRequest(), makeParams('work'));

    const [, deps] = vi.mocked(buildWhatif).mock.calls[0];
    expect(deps.supabaseUserClient).toBe(supabase);
    expect(deps.supabaseServiceClient).toBe(SERVICE_CLIENT);
    expect(deps.openaiClient).toBe(OPENAI_CLIENT);
    expect(deps.embeddingsClient).toBe(EMBEDDINGS_CLIENT);
    expect(deps.ragQueryText).toBe(buildWhatifRagQueryText);
  });
});

describe('토큰 deduct/refund', () => {
  function makeAuthedForToken() {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    return supabase;
  }

  it('잔액 부족 → 402 INSUFFICIENT_TOKENS, buildWhatif 미호출', async () => {
    rpcFn.mockResolvedValueOnce({ error: { message: 'insufficient balance', code: 'P0001' } });
    makeAuthedForToken();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('INSUFFICIENT_TOKENS');
    expect(buildWhatif).not.toHaveBeenCalled();
  });

  it('정상 빌드(fromCache:false) → deduct_tokens({ delta:-4, reason:"whatif_use", ref:"work" }), 200', async () => {
    makeAuthedForToken();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(200);
    expect(rpcFn).toHaveBeenCalledWith(
      'deduct_tokens',
      expect.objectContaining({ delta: -4, reason: 'whatif_use', ref: 'work' }),
    );
  });

  it('GROUNDING_FAILED throw → 422 + refund_tokens({ delta:4, reason:"whatif_refund" })', async () => {
    vi.mocked(buildWhatif).mockRejectedValue(new Error('GROUNDING_FAILED: []'));
    makeAuthedForToken();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(422);
    expect(rpcFn).toHaveBeenCalledWith(
      'refund_tokens',
      expect.objectContaining({ delta: 4, reason: 'whatif_refund' }),
    );
  });

  it('generic throw → 500 + refund_tokens 1회', async () => {
    vi.mocked(buildWhatif).mockRejectedValue(new Error('unexpected crash'));
    makeAuthedForToken();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(500);
    expect(rpcFn).toHaveBeenCalledWith(
      'refund_tokens',
      expect.objectContaining({ delta: 4, reason: 'whatif_refund' }),
    );
  });

  it('캐시 적중(fromCache:true) → deduct 후 즉시 환불, 200 반환', async () => {
    vi.mocked(buildWhatif).mockResolvedValue({ result: WHATIF_RESULT, fromCache: true } as never);
    makeAuthedForToken();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(200);
    expect(rpcFn).toHaveBeenCalledWith(
      'deduct_tokens',
      expect.objectContaining({ delta: -4, reason: 'whatif_use' }),
    );
    expect(rpcFn).toHaveBeenCalledWith(
      'refund_tokens',
      expect.objectContaining({ delta: 4, reason: 'whatif_refund' }),
    );
  });
});
