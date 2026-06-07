import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- 모듈 mocks (호이스팅) ---
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/hapcard/builder');
vi.mock('@/lib/llm/clients');
vi.mock('@/lib/rag/query-text');
// pay-per-use 게이트는 라우트 단에서 mock — 게이트 내부는 feature-gate/cash-gen-limit 자체 테스트가 커버.
vi.mock('@/lib/payments/feature-gate');
vi.mock('@/lib/payments/cash-gen-limit');
vi.mock('@/lib/today/lazy-relation-chart');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { buildHapcard, getHapcardCacheKey } from '@/lib/hapcard/builder';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import { buildRagQueryText } from '@/lib/rag/query-text';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { ensureRelationChartRow } from '@/lib/today/lazy-relation-chart';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { POST } from '@/app/api/hapcards/route';
import type { ChartCore } from '@/types/chart';
import type { HapcardResult } from '@/types/hapcard';

// --- 픽스처 ---

const SELF_CHART_CORE: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const RELATION_CHART_CORE: ChartCore = {
  year_pillar: '기묘',
  month_pillar: '경진',
  day_pillar: '신사',
  hour_pillar: null,
  day_master_element: '금',
  five_elements_counts: { 목: 0, 화: 0, 토: 2, 금: 2, 수: 0 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const VALID_BODY = {
  relation_id: '550e8400-e29b-41d4-a716-446655440000',
  mode: '일합',
  theory_profile_version: 'v1.0-late_zi',
};

const HAPCARD_RESULT: HapcardResult = {
  hapcard_id: 'hapcard-uuid-001',
  user_id: 'user-uuid-001',
  relation_id: VALID_BODY.relation_id,
  mode: '일합',
  target_date: '2026-05-21',
  compat_score: 72,
  score_breakdown: {
    hap_chung_hyung_hae: 70,
    sipsin: 75,
    ohaeng: 68,
    yunse_adjustment: 0,
    mode_adjustment: 5,
  },
  content: {
    main_text: '갑목일간',
    cause_factors: [{ name: '원인1', effect: '결과1' }],
    classic_citation: [],
    actions: ['행동1'],
    why_cards: [{ title: '제목', reason: '이유' }],
  },
  prompt_version: 'v0.2',
  llm_model: 'gpt-5',
  cache_key: 'cache-key-abc',
  user_chart_hash: 'self-hash-abc',
  relation_chart_hash: 'rel-hash-def',
  archived_at: null,
  version_label: null,
  created_at: '2026-05-05T00:00:00Z',
};

// --- mock helpers ---

function makeAuthedSupabaseClient(opts: {
  userId?: string | null;
  userChart?: { chart_core: ChartCore; chart_hash: string } | null;
  relationChart?: { chart_core: ChartCore; chart_hash: string } | null;
  userChartError?: { message: string } | null;
  relationChartError?: { message: string } | null;
  hapcardCache?: { hapcard_id: string } | null;
  hapcardCacheError?: { message: string } | null;
}) {
  const userId = opts.userId === undefined ? 'user-uuid-001' : opts.userId;
  const userChart = opts.userChart === undefined
    ? { chart_core: SELF_CHART_CORE, chart_hash: 'self-hash-abc' }
    : opts.userChart;
  const relationChart = opts.relationChart === undefined
    ? { chart_core: RELATION_CHART_CORE, chart_hash: 'rel-hash-def' }
    : opts.relationChart;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  // user_charts query: from('user_charts').select(...).eq('user_id', x).eq('theory_profile_version', y).maybeSingle()
  const userChartMaybeSingle = vi.fn().mockResolvedValue({
    data: userChart,
    error: opts.userChartError ?? null,
  });
  const relationChartMaybeSingle = vi.fn().mockResolvedValue({
    data: relationChart,
    error: opts.relationChartError ?? null,
  });
  const hapcardCacheMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.hapcardCache ?? null,
    error: opts.hapcardCacheError ?? null,
  });

  // 두 query 모두 .eq().eq().order().limit().maybeSingle() chain (fetchLatest*ForVersion 헬퍼)
  const makeChain = (maybeSingle: ReturnType<typeof vi.fn>) => {
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const second = { order: orderFn };
    const firstEq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(second) });
    return { select: vi.fn().mockReturnValue({ eq: firstEq }) };
  };

  const from = vi.fn((table: string) => {
    if (table === 'user_charts') return makeChain(userChartMaybeSingle);
    if (table === 'relation_charts') return makeChain(relationChartMaybeSingle);
    if (table === 'hapcards') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: hapcardCacheMaybeSingle }),
        }),
      };
    }
    return {
      select: vi.fn(),
      insert: vi.fn(),
    };
  });

  return {
    auth: { getUser },
    from,
  };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/hapcards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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
  vi.mocked(buildRagQueryText).mockReturnValue('테스트 쿼리');
  vi.mocked(getHapcardCacheKey).mockResolvedValue('cache-key-abc');
  vi.mocked(buildHapcard).mockResolvedValue(HAPCARD_RESULT);
  vi.mocked(ensureRelationChartRow).mockResolvedValue(null);
  // 기본: 무료 경로(부적 차감 성공). rpcFn 은 이제 refund_tokens_once 전용.
  vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'free', price: FEATURE_PRICES_KRW.hapcard, charged: true });
  vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: true, count: 0, limit: 5 });
  rpcFn.mockResolvedValue({ data: { balance_after: 100, inserted: true }, error: null });
});

describe('POST /api/hapcards', () => {
  it('200 → HapcardResult JSON 반환 (성공 경로)', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hapcard_id).toBe(HAPCARD_RESULT.hapcard_id);
    expect(body.compat_score).toBe(72);
    // 게이트가 (service, userId, feature, ref) 로 호출됐는지 — 라우트↔게이트 배선 검증.
    expect(resolveFeatureCharge).toHaveBeenCalledWith(SERVICE_CLIENT, 'user-uuid-001', 'hapcard', 'cache-key-abc');
  });

  it('401 → 미인증 (auth.getUser 가 null user 반환)', async () => {
    const supabase = makeAuthedSupabaseClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('400 → body 가 invalid (relation_id 없음)', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ mode: '일합', theory_profile_version: 'v1.0-late_zi' }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('400 → mode 가 6모드 enum 외 값', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ ...VALID_BODY, mode: '잘못된모드' }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('400 → relation_id 가 UUID 형식 아님', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ ...VALID_BODY, relation_id: 'not-a-uuid' }),
    );

    expect(res.status).toBe(400);
  });

  it('400 → 알 수 없는 필드 거부 (PII 가드 — birth_date 등 차단)', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ ...VALID_BODY, birth_date: '1990-01-01' }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('404 → user_chart 가 해당 theory_profile_version 으로 없음', async () => {
    const supabase = makeAuthedSupabaseClient({ userChart: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('USER_CHART_NOT_FOUND');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('relation_chart 누락 + lazy compute 성공 → buildHapcard 까지 진행', async () => {
    const supabase = makeAuthedSupabaseClient({ relationChart: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(ensureRelationChartRow).mockResolvedValueOnce({
      chart_core: RELATION_CHART_CORE,
      chart_hash: 'lazy-rel-hash',
    });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(ensureRelationChartRow).toHaveBeenCalledWith(
      supabase,
      VALID_BODY.relation_id,
      'user-uuid-001',
      expect.any(String),
      VALID_BODY.theory_profile_version,
    );
    const [input] = vi.mocked(buildHapcard).mock.calls[0];
    expect(input.relation).toEqual(RELATION_CHART_CORE);
    expect(input.relation_chart_hash).toBe('lazy-rel-hash');
  });

  it('404 → relation_chart 가 해당 relation_id+version 으로 없고 lazy compute 도 실패', async () => {
    const supabase = makeAuthedSupabaseClient({ relationChart: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(ensureRelationChartRow).mockResolvedValueOnce(null);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('RELATION_CHART_NOT_FOUND');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('500 → lazy relation chart DB 오류는 lookup failed 로 반환하고 build 미호출', async () => {
    const supabase = makeAuthedSupabaseClient({ relationChart: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(ensureRelationChartRow).mockRejectedValueOnce(
      new Error('upsert failed birth_date=1995-06-15 birth_time=10:30:00 gender=F'),
    );

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('RELATION_CHART_LOOKUP_FAILED');
    expect(JSON.stringify(body)).not.toContain('1995-06-15');
    expect(JSON.stringify(body)).not.toContain('10:30:00');
    expect(JSON.stringify(body)).not.toContain('gender=F');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('500 → buildHapcard 가 unexpected error throw', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildHapcard).mockRejectedValue(new Error('UNEXPECTED: db crashed'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(rpcFn).toHaveBeenCalledWith('refund_tokens_once', {
      uid: 'user-uuid-001',
      delta: 10,
      reason: 'hapcard_refund',
      ref: 'cache-key-abc',
    });
    consoleSpy.mockRestore();
  });

  it('buildHapcard 실패 로그와 응답에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    rpcFn.mockResolvedValueOnce({ data: null, error: { message: 'refund birth_date=1995-06-15' } });
    vi.mocked(buildHapcard).mockRejectedValue(
      new Error('UNEXPECTED birth_date=1995-06-15 birth_time=10:30:00 gender=F'),
    );

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).not.toContain('1995-06-15');
    expect(logged).not.toContain('10:30:00');
    expect(logged).not.toContain('gender=F');
    expect(JSON.stringify(body)).not.toContain('1995-06-15');
    expect(JSON.stringify(body)).not.toContain('10:30:00');
    expect(JSON.stringify(body)).not.toContain('gender=F');
    expect(logged).toContain('birth_date=[redacted]');
    expect(logged).toContain('birth_time=[redacted]');
    consoleSpy.mockRestore();
  });

  it('422 → buildHapcard 가 GROUNDING_FAILED throw', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildHapcard).mockRejectedValue(new Error('GROUNDING_FAILED: x'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('GROUNDING_FAILED');
    expect(rpcFn).toHaveBeenCalledWith('refund_tokens_once', {
      uid: 'user-uuid-001',
      delta: 10,
      reason: 'hapcard_refund',
      ref: 'cache-key-abc',
    });
  });

  it('pay_required + 한도 OK → 선생성 후 402 PAYMENT_REQUIRED (본문 보류)', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.hapcard, charged: false });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('hapcard');
    expect(body.ref).toBe('cache-key-abc');
    expect(body.amount_krw).toBe(1000);
    // 선생성: buildHapcard 는 호출되되 본문은 반환하지 않음
    expect(buildHapcard).toHaveBeenCalledOnce();
    // 현금 경로는 부적 차감/환불 없음
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it('pay_required + 일일 한도 초과 → 429 RATE_LIMITED, buildHapcard 미호출', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.hapcard, charged: false });
    vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: false, count: 5, limit: 5 });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('pay_required + 일일 한도 초과는 LLM 클라이언트를 만들지 않고 429로 멈춘다', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({
      mode: 'pay_required',
      price: FEATURE_PRICES_KRW.hapcard,
      charged: false,
    });
    vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: false, count: 5, limit: 5 });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(429);
    expect(buildHapcard).not.toHaveBeenCalled();
    expect(createOpenAiClient).not.toHaveBeenCalled();
    expect(createEmbeddingsClient).not.toHaveBeenCalled();
  });

  it('pay_required 선생성 중 GROUNDING_FAILED → 422, 환불 없음', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.hapcard, charged: false });
    vi.mocked(buildHapcard).mockRejectedValue(new Error('GROUNDING_FAILED: x'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('GROUNDING_FAILED');
    expect(rpcFn).not.toHaveBeenCalled(); // charged=false → 환불 호출 없음
  });

  it('unlocked → 부적 차감 없이 캐시 본문 200, 한도 체크 없음', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'unlocked', price: FEATURE_PRICES_KRW.hapcard, charged: false });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(buildHapcard).toHaveBeenCalledOnce();
    expect(rpcFn).not.toHaveBeenCalled();
    expect(checkCashGenLimit).not.toHaveBeenCalled();
  });

  it('free(charged=false, 멱등 재차감) + build 실패 → 500, 환불 호출 없음', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'free', price: FEATURE_PRICES_KRW.hapcard, charged: false });
    vi.mocked(buildHapcard).mockRejectedValue(new Error('UNEXPECTED'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it('unlocked + build 실패 → 500, 환불 호출 없음', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'unlocked', price: FEATURE_PRICES_KRW.hapcard, charged: false });
    vi.mocked(buildHapcard).mockRejectedValue(new Error('UNEXPECTED'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it('real-gate 통합: 미잠금 + 부적 부족 → 402 end-to-end (게이트 mock 미사용)', async () => {
    const realGate = (await vi.importActual('@/lib/payments/feature-gate')) as {
      resolveFeatureCharge: typeof resolveFeatureCharge;
    };
    vi.mocked(resolveFeatureCharge).mockImplementation(realGate.resolveFeatureCharge);

    // 최소 from-chain: token_ledger/payments 둘 다 miss(미잠금), deduct rpc → error(잔액 부족).
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

    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('hapcard');
    expect(body.amount_krw).toBe(1000);
  });

  it('buildHapcard 호출 시 input은 정확하고 LLM deps는 lazy wrapper로 전달', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    await POST(makeRequest(VALID_BODY));

    expect(buildHapcard).toHaveBeenCalledTimes(1);
    const [input, deps] = vi.mocked(buildHapcard).mock.calls[0];
    expect(input.user_id).toBe('user-uuid-001');
    expect(input.relation_id).toBe(VALID_BODY.relation_id);
    expect(input.mode).toBe('일합');
    expect(input.self).toEqual(SELF_CHART_CORE);
    expect(input.self_chart_hash).toBe('self-hash-abc');
    expect(input.relation).toEqual(RELATION_CHART_CORE);
    expect(input.relation_chart_hash).toBe('rel-hash-def');
    expect(input.theory_profile_version).toBe('v1.0-late_zi');
    expect(input.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(deps.supabaseUserClient).toBe(supabase);
    expect(deps.supabaseServiceClient).toBe(SERVICE_CLIENT);
    expect(deps.ragQueryText).toBe(buildRagQueryText);
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

  it('question_slot 옵션 필드는 그대로 builder 에 전달', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    await POST(
      makeRequest({ ...VALID_BODY, question_slot: '연애 갈등 해결' }),
    );

    const [input] = vi.mocked(buildHapcard).mock.calls[0];
    expect(input.question_slot).toBe('연애 갈등 해결');
  });

  it('MeEdit 후 user_charts 복수 row → latest row 반환으로 200 (USER_CHART_LOOKUP_FAILED 회귀)', async () => {
    // MeEditDrawer 로 생년월일 변경 시 user_charts 에 신규 row INSERT (ADR-016 FK 보존).
    // 구 버전(.maybeSingle() 직접)은 2개 row 에서 PostgREST 에러 발생.
    // fetchLatestUserChartForVersion 이 .order(desc).limit(1) 로 latest 반환.
    const supabase = makeAuthedSupabaseClient({
      userChart: { chart_core: SELF_CHART_CORE, chart_hash: 'post-edit-hash' },
    });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const [input] = vi.mocked(buildHapcard).mock.calls[0];
    expect(input.self_chart_hash).toBe('post-edit-hash');
  });

  it('JSON parse 실패 → 400 INVALID_BODY', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const req = new Request('http://localhost/api/hapcards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ invalid json',
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });
});
