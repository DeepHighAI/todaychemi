import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/whatif/builder');
vi.mock('@/lib/whatif/query-text');
vi.mock('@/lib/llm/clients');
vi.mock('@/lib/payments/feature-gate');
vi.mock('@/lib/payments/cash-gen-limit');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { buildWhatif, getWhatifCacheKey } from '@/lib/whatif/builder';
import { buildWhatifRagQueryText } from '@/lib/whatif/query-text';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
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
  llm_model: 'gpt-5',
  cache_key: 'cachecachecachecachecachecachecachecachecachecachecachecachecach',
  chart_hash: MOCK_CHART_HASH,
  created_at: '2026-05-09T00:00:00Z',
};

// user_charts 쿼리 체인: .select().eq('user_id').order().limit().maybeSingle()
function makeAuthedClient(opts: {
  userId?: string | null;
  chartRow?: typeof CHART_ROW | null;
  chartError?: { message: string } | null;
  whatifCache?: { whatif_id: string } | null;
  whatifCacheError?: { message: string } | null;
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
    if (table === 'whatif_results') {
      const whatifMaybeSingle = vi.fn().mockResolvedValue({
        data: opts.whatifCache ?? null,
        error: opts.whatifCacheError ?? null,
      });
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: whatifMaybeSingle }),
        }),
      };
    }
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
  rpcFn.mockReset();
  vi.mocked(createServiceRoleClient).mockReturnValue(SERVICE_CLIENT as never);
  vi.mocked(createOpenAiClient).mockReturnValue(OPENAI_CLIENT as never);
  vi.mocked(createEmbeddingsClient).mockReturnValue(EMBEDDINGS_CLIENT as never);
  vi.mocked(buildWhatifRagQueryText).mockReturnValue('work 일주 병인 일간 화');
  vi.mocked(getWhatifCacheKey).mockReturnValue(WHATIF_RESULT.cache_key);
  vi.mocked(buildWhatif).mockResolvedValue({ result: WHATIF_RESULT, fromCache: false } as never);
  // 기본: 무료 경로(부적 차감 성공). rpcFn 은 refund_tokens_once 전용.
  vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'free', price: FEATURE_PRICES_KRW.whatif, charged: true });
  vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: true, count: 0, limit: 5 });
  rpcFn.mockResolvedValue({ data: { balance_after: 70, inserted: true }, error: null });
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
    expect(resolveFeatureCharge).toHaveBeenCalledWith(SERVICE_CLIENT, USER_ID, 'whatif', WHATIF_RESULT.cache_key);
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

  it('user_charts lookup DB 에러 응답에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    const supabase = makeAuthedClient({
      chartError: { message: 'lookup failed birth_date=1991-03-15 birth_time=14:30 gender=F' },
    });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(), makeParams('work'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('1991-03-15');
    expect(JSON.stringify(body)).not.toContain('14:30');
    expect(JSON.stringify(body)).not.toContain('gender=F');
    expect(JSON.stringify(body)).toContain('birth_date=[redacted]');
    expect(JSON.stringify(body)).toContain('birth_time=[redacted]');
    expect(JSON.stringify(body)).toContain('gender=[redacted]');
    expect(buildWhatif).not.toHaveBeenCalled();
  });

  it('422 GROUNDING_FAILED → buildWhatif 가 GROUNDING_FAILED throw', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildWhatif).mockRejectedValue(new Error('GROUNDING_FAILED: []'));

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('GROUNDING_FAILED');
    expect(consoleSpy).toHaveBeenCalledWith(
      'whatif_build_failed',
      expect.objectContaining({ type: 'work', error: 'Error: GROUNDING_FAILED: []' }),
    );
    consoleSpy.mockRestore();
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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildWhatif).mockRejectedValue(new Error('unexpected crash'));

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    consoleSpy.mockRestore();
  });

  it('buildWhatif 실패 로그와 응답에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    rpcFn.mockResolvedValueOnce({ data: null, error: { message: 'refund birth_time=14:30' } });
    vi.mocked(buildWhatif).mockRejectedValue(
      new Error('unexpected birth_date=1991-03-15 birth_time=14:30 gender=F'),
    );

    const res = await POST(makeRequest(), makeParams('work'));
    const body = await res.json();

    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).not.toContain('1991-03-15');
    expect(logged).not.toContain('14:30');
    expect(logged).not.toContain('gender=F');
    expect(JSON.stringify(body)).not.toContain('1991-03-15');
    expect(JSON.stringify(body)).not.toContain('14:30');
    expect(JSON.stringify(body)).not.toContain('gender=F');
    expect(logged).toContain('birth_date=[redacted]');
    expect(logged).toContain('birth_time=[redacted]');
    consoleSpy.mockRestore();
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

  it('buildWhatif deps — DB/RAG는 직접 전달하고 LLM 클라이언트는 lazy wrapper로 전달', async () => {
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    await POST(makeRequest(), makeParams('work'));

    const [, deps] = vi.mocked(buildWhatif).mock.calls[0];
    expect(deps.supabaseUserClient).toBe(supabase);
    expect(deps.supabaseServiceClient).toBe(SERVICE_CLIENT);
    expect(deps.ragQueryText).toBe(buildWhatifRagQueryText);
    expect(createOpenAiClient).not.toHaveBeenCalled();
    expect(createEmbeddingsClient).not.toHaveBeenCalled();

    await deps.openaiClient.chat.completions.create({ model: 'gpt-5-mini' });
    expect(createOpenAiClient).toHaveBeenCalledTimes(1);
    expect(OPENAI_CLIENT.chat.completions.create).toHaveBeenCalledWith(
      { model: 'gpt-5-mini' },
      undefined,
    );

    await deps.embeddingsClient.create({ model: 'text-embedding-3-small', input: 'query' });
    expect(createEmbeddingsClient).toHaveBeenCalledTimes(1);
    expect(EMBEDDINGS_CLIENT.create).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'query',
    });
  });

  it('pay_required + 일일 한도 초과는 LLM 클라이언트를 만들지 않고 429로 멈춘다', async () => {
    vi.mocked(resolveFeatureCharge).mockResolvedValue({
      mode: 'pay_required',
      price: FEATURE_PRICES_KRW.whatif,
      charged: false,
    });
    vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: false, count: 5, limit: 5 });
    const supabase = makeAuthedClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(429);
    expect(buildWhatif).not.toHaveBeenCalled();
    expect(createOpenAiClient).not.toHaveBeenCalled();
    expect(createEmbeddingsClient).not.toHaveBeenCalled();
  });
});

describe('또 다른 나 유료 이용 (pay-per-use 모델 C)', () => {
  function makeAuthedForPaidUse(opts?: Parameters<typeof makeAuthedClient>[0]) {
    const supabase = makeAuthedClient({});
    const client = opts ? makeAuthedClient(opts) : supabase;
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    return client;
  }

  it('pay_required + 한도 OK → 선생성 후 402 PAYMENT_REQUIRED (본문 보류)', async () => {
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.whatif, charged: false });
    makeAuthedForPaidUse();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('whatif');
    expect(body.ref).toBe(WHATIF_RESULT.cache_key);
    expect(body.amount_krw).toBe(800);
    expect(buildWhatif).toHaveBeenCalledOnce(); // 선생성
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it('pay_required + 일일 한도 초과 → 429 RATE_LIMITED, buildWhatif 미호출', async () => {
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.whatif, charged: false });
    vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: false, count: 5, limit: 5 });
    makeAuthedForPaidUse();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(buildWhatif).not.toHaveBeenCalled();
  });

  it('pay_required 선생성 중 GROUNDING_FAILED → 422, 환불 없음', async () => {
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.whatif, charged: false });
    vi.mocked(buildWhatif).mockRejectedValue(new Error('GROUNDING_FAILED: []'));
    makeAuthedForPaidUse();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(422);
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it('정상 빌드(free) → resolveFeatureCharge 호출, 200', async () => {
    makeAuthedForPaidUse();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(200);
    expect(resolveFeatureCharge).toHaveBeenCalledWith(SERVICE_CLIENT, USER_ID, 'whatif', WHATIF_RESULT.cache_key);
  });

  it('free + GROUNDING_FAILED throw → 422 + refund_tokens_once 호출', async () => {
    vi.mocked(buildWhatif).mockRejectedValue(new Error('GROUNDING_FAILED: []'));
    makeAuthedForPaidUse();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(422);
    expect(rpcFn).toHaveBeenCalledWith('refund_tokens_once', {
      uid: USER_ID,
      delta: 8,
      reason: 'whatif_refund',
      ref: WHATIF_RESULT.cache_key,
    });
  });

  it('free + generic throw → 500 + refund_tokens_once 호출', async () => {
    vi.mocked(buildWhatif).mockRejectedValue(new Error('unexpected crash'));
    makeAuthedForPaidUse();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(500);
    expect(rpcFn).toHaveBeenCalledWith('refund_tokens_once', {
      uid: USER_ID,
      delta: 8,
      reason: 'whatif_refund',
      ref: WHATIF_RESULT.cache_key,
    });
  });

  it('unlocked → 포인트 RPC 없이 200, 한도 체크 없음', async () => {
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'unlocked', price: FEATURE_PRICES_KRW.whatif, charged: false });
    vi.mocked(buildWhatif).mockResolvedValue({ result: WHATIF_RESULT, fromCache: true } as never);
    makeAuthedForPaidUse({ whatifCache: { whatif_id: WHATIF_RESULT.id } });

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(200);
    expect(rpcFn).not.toHaveBeenCalled();
    expect(checkCashGenLimit).not.toHaveBeenCalled();
  });

  it('unlocked + buildWhatif cache hit 경로는 route 레벨에서 LLM 클라이언트를 즉시 만들지 않는다', async () => {
    vi.mocked(resolveFeatureCharge).mockResolvedValue({
      mode: 'unlocked',
      price: FEATURE_PRICES_KRW.whatif,
      charged: false,
    });
    vi.mocked(buildWhatif).mockResolvedValue({ result: WHATIF_RESULT, fromCache: true } as never);
    makeAuthedForPaidUse({ whatifCache: { whatif_id: WHATIF_RESULT.id } });

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(200);
    expect(createOpenAiClient).not.toHaveBeenCalled();
    expect(createEmbeddingsClient).not.toHaveBeenCalled();
  });

  it('unlocked 빌드 성공 시 환불 실패 로그를 남기지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'unlocked', price: FEATURE_PRICES_KRW.whatif, charged: false });
    vi.mocked(buildWhatif).mockResolvedValue({ result: WHATIF_RESULT, fromCache: true } as never);
    makeAuthedForPaidUse({ whatifCache: { whatif_id: WHATIF_RESULT.id } });

    await POST(makeRequest(), makeParams('love'));

    expect(consoleSpy).not.toHaveBeenCalledWith('whatif_refund_failed', expect.anything());
    consoleSpy.mockRestore();
  });

  it('free 빌드 실패 후 환불 실패 로그를 남긴다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpcFn.mockResolvedValueOnce({ data: null, error: { message: 'refund failed' } });
    vi.mocked(buildWhatif).mockRejectedValue(new Error('GROUNDING_FAILED: []'));
    makeAuthedForPaidUse();

    await POST(makeRequest(), makeParams('work'));

    expect(consoleSpy).toHaveBeenCalledWith('whatif_refund_failed', expect.anything());
    consoleSpy.mockRestore();
  });

  it('free(charged=false, 멱등 재차감)에서 빌드 실패 시 환불 RPC 미호출', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'free', price: FEATURE_PRICES_KRW.whatif, charged: false });
    vi.mocked(buildWhatif).mockRejectedValue(new Error('unexpected crash'));
    makeAuthedForPaidUse();

    await POST(makeRequest(), makeParams('work'));

    expect(consoleSpy).not.toHaveBeenCalledWith('whatif_refund_failed', expect.anything());
    expect(rpcFn).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('real-gate 통합: 미잠금 + 부적 부족 → 402 end-to-end (게이트 mock 미사용)', async () => {
    const realGate = (await vi.importActual('@/lib/payments/feature-gate')) as {
      resolveFeatureCharge: typeof resolveFeatureCharge;
    };
    vi.mocked(resolveFeatureCharge).mockImplementation(realGate.resolveFeatureCharge);

    const leaf = { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.limit = vi.fn(() => leaf);
    const localService = {
      from: vi.fn(() => chain),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'INSUFFICIENT_TOKENS', code: 'P0001' } }),
    };
    vi.mocked(createServiceRoleClient).mockReturnValue(localService as never);
    makeAuthedForPaidUse();

    const res = await POST(makeRequest(), makeParams('work'));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('whatif');
    expect(body.amount_krw).toBe(800);
  });
});
