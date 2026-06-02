import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- 모듈 mocks (호이스팅) ---
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/replay/builder');
vi.mock('@/lib/payments/feature-gate');
vi.mock('@/lib/payments/cash-gen-limit');
vi.mock('@/lib/payments/feature-unlock');
vi.mock('@/lib/today/kst-date');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { buildReplay } from '@/lib/replay/builder';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { isFeatureUnlocked } from '@/lib/payments/feature-unlock';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { todayKST } from '@/lib/today/kst-date';
import { POST } from '@/app/api/hapcards/[id]/replay/route';
import type { HapcardResult, HapcardReplayResult } from '@/types/hapcard';

// --- 픽스처 ---

const HAPCARD_ID = 'hapcard-uuid-001';
const USER_ID = 'user-uuid-001';
const JINJIN_DATE = '2026-05-06';
// 라우트가 todayKST() 로 산출하는 일진 — mock 으로 고정해 ref 단언을 결정형으로.
const TODAY = '2026-06-02';
const REF = `replay:${HAPCARD_ID}:${TODAY}`;

const HAPCARD_ROW: HapcardResult = {
  hapcard_id: HAPCARD_ID,
  user_id: USER_ID,
  relation_id: 'relation-uuid-001',
  mode: '일합',
  target_date: '2026-05-20',
  compat_score: 72,
  score_breakdown: { hap_chung_hyung_hae: 70, sipsin: 75, ohaeng: 68, yunse_adjustment: 0, mode_adjustment: 5 },
  content: {
    main_text: '갑목일간',
    cause_factors: [{ name: '원인1', effect: '결과1' }],
    classic_citation: [],
    actions: ['행동1'],
    why_cards: [{ title: '제목', reason: '이유' }],
  },
  prompt_version: 'v0.2',
  llm_model: 'gpt-5',
  cache_key: 'cache-abc',
  user_chart_hash: 'self-hash',
  relation_chart_hash: 'rel-hash',
  archived_at: null,
  version_label: null,
  created_at: '2026-05-01T00:00:00Z',
};

const REPLAY_RESULT: HapcardReplayResult = {
  ...HAPCARD_ROW,
  replay_id: 'replay-uuid-001',
  jinjin_date: JINJIN_DATE,
  created_at: '2026-05-06T01:00:00Z',
};

// --- mock helpers ---

function makeUserClient(opts: {
  userId?: string | null;
  hapcardRow?: HapcardResult | null;
  hapcardError?: { message: string } | null;
  idempotencyRow?: HapcardReplayResult | null;
}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const hapcardRow = opts.hapcardRow === undefined ? HAPCARD_ROW : opts.hapcardRow;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  // hapcards: .from('hapcards').select('*').eq('hapcard_id', id).eq('user_id', userId).maybySingle()
  const hapcardMaybe = vi.fn().mockResolvedValue({
    data: hapcardRow,
    error: opts.hapcardError ?? null,
  });
  // hapcard_replays idempotency: .select().eq('hapcard_id').eq('jinjin_date').maybySingle()
  const idempotencyMaybe = vi.fn().mockResolvedValue({
    data: opts.idempotencyRow ?? null,
    error: null,
  });

  const makeChain = (maybeSingle: ReturnType<typeof vi.fn>) => {
    const leaf = { maybeSingle };
    const secondEq = vi.fn().mockReturnValue(leaf);
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    return { select: vi.fn().mockReturnValue({ eq: firstEq }) };
  };

  const from = vi.fn((table: string) => {
    if (table === 'hapcards') return makeChain(hapcardMaybe);
    if (table === 'hapcard_replays') return makeChain(idempotencyMaybe);
    return { select: vi.fn(), insert: vi.fn() };
  });

  return { auth: { getUser }, from };
}

// 게이트(deduct)는 mock 된 resolveFeatureCharge 가 담당. serviceClient.rpc 는 환불(refund_tokens_once)만.
function makeServiceClient() {
  const refund = vi.fn().mockResolvedValue({ data: 14, error: null });
  const rpc = vi.fn((name: string) => {
    if (name === 'refund_tokens_once') return refund();
    return Promise.resolve({ data: null, error: null });
  });
  return { client: { rpc }, refund };
}

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/hapcards/${HAPCARD_ID}/replay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function makeParams(id = HAPCARD_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildReplay).mockResolvedValue(REPLAY_RESULT);
  vi.mocked(todayKST).mockReturnValue(TODAY);
  // 기본: 무료 경로. isFeatureUnlocked 기본 true (idempotency hit 시 본문 공개).
  vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'free', price: FEATURE_PRICES_KRW.replay, charged: true });
  vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: true, count: 0, limit: 5 });
  vi.mocked(isFeatureUnlocked).mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/hapcards/[id]/replay', () => {
  it('401 → 미인증 (auth.getUser 가 null user 반환)', async () => {
    const userClient = makeUserClient({ userId: null });
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(buildReplay).not.toHaveBeenCalled();
  });

  it('400 → body Zod strict 위반 (알 수 없는 필드)', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);

    const res = await POST(makeRequest({ birth_date: '1990-01-01' }), makeParams());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
    expect(buildReplay).not.toHaveBeenCalled();
  });

  it('404 → hapcard 미존재 또는 다른 user 소유', async () => {
    const userClient = makeUserClient({ hapcardRow: null });
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('HAPCARD_NOT_FOUND');
    expect(buildReplay).not.toHaveBeenCalled();
  });

  it('200 → idempotency hit + 잠금해제됨 → 저장된 row 반환, 재빌드 없음', async () => {
    const userClient = makeUserClient({ idempotencyRow: REPLAY_RESULT });
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(isFeatureUnlocked).mockResolvedValue(true);

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replay_id).toBe('replay-uuid-001');
    expect(buildReplay).not.toHaveBeenCalled();
    expect(resolveFeatureCharge).not.toHaveBeenCalled(); // idempotency hit 은 게이트 미진입
  });

  it('402 → idempotency row 존재하나 미잠금(선생성 미결제) → 재빌드 없이 PAYMENT_REQUIRED', async () => {
    const userClient = makeUserClient({ idempotencyRow: REPLAY_RESULT });
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(isFeatureUnlocked).mockResolvedValue(false);

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('replay');
    expect(body.ref).toBe(REF);
    expect(body.amount_krw).toBe(400);
    expect(buildReplay).not.toHaveBeenCalled();
    expect(resolveFeatureCharge).not.toHaveBeenCalled();
  });

  it('402 → pay_required (잔액 부족) → 선생성 후 PAYMENT_REQUIRED', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient, refund } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.replay, charged: false });

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('replay');
    expect(body.ref).toBe(REF);
    expect(body.amount_krw).toBe(400);
    expect(buildReplay).toHaveBeenCalledOnce(); // 선생성
    expect(refund).not.toHaveBeenCalled();
  });

  it('429 → pay_required + 일일 한도 초과 → buildReplay 미호출', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.replay, charged: false });
    vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: false, count: 5, limit: 5 });

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(buildReplay).not.toHaveBeenCalled();
  });

  it('500 → pay_required 선생성 실패 → 환불 없음 (charged=false)', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient, refund } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'pay_required', price: FEATURE_PRICES_KRW.replay, charged: false });
    vi.mocked(buildReplay).mockRejectedValue(new Error('LLM_TIMEOUT'));

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(500);
    expect(refund).not.toHaveBeenCalled();
  });

  it('503 → LLM_ALL_PROVIDERS_DOWN 환경 변수가 true', async () => {
    vi.stubEnv('LLM_ALL_PROVIDERS_DOWN', 'true');
    const userClient = makeUserClient({});
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('REPLAY_DURING_OUTAGE');
    expect(buildReplay).not.toHaveBeenCalled();
  });

  it('500 + refund → buildReplay 실패 시 refund_tokens 호출 후 500', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient, refund } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(buildReplay).mockRejectedValue(new Error('LLM_TIMEOUT'));

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it('refund 실패 → console.error("replay_refund_failed") 호출', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient, refund } = makeServiceClient();
    refund.mockResolvedValueOnce({ data: null, error: { message: 'rpc unavailable' } });
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(buildReplay).mockRejectedValue(new Error('boom'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      'replay_refund_failed',
      expect.objectContaining({
        user_id: USER_ID,
        hapcard_id: HAPCARD_ID,
        phase: 'build_error',
        original_error: 'boom',
        refund_error: 'rpc unavailable',
      }),
    );
    consoleSpy.mockRestore();
  });

  it('refund 성공 → console.error("replay_refund_failed") 미호출', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(buildReplay).mockRejectedValue(new Error('crash'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await POST(makeRequest({}), makeParams());

    expect(consoleSpy).not.toHaveBeenCalledWith('replay_refund_failed', expect.anything());
    consoleSpy.mockRestore();
  });

  it('201 → 성공 경로(free) — HapcardReplayResult 반환, 게이트 dated ref 호출', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);

    const res = await POST(makeRequest({ replay_reason: '궁금해서' }), makeParams());

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.replay_id).toBe('replay-uuid-001');
    expect(body.jinjin_date).toBe(JINJIN_DATE);
    // 게이트가 dated ref (replay:{id}:{today}) 로 호출됐는지 — idempotency 버그 수정 검증.
    expect(resolveFeatureCharge).toHaveBeenCalledWith(svcClient, USER_ID, 'replay', REF);
    expect(buildReplay).toHaveBeenCalledTimes(1);
    const [input] = vi.mocked(buildReplay).mock.calls[0];
    expect(input.hapcard.hapcard_id).toBe(HAPCARD_ID);
    expect(input.replay_reason).toBe('궁금해서');
  });

  it('500 → free(charged=false, 멱등 재차감) build 실패 → 환불 호출 없음', async () => {
    const userClient = makeUserClient({});
    const { client: svcClient, refund } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({ mode: 'free', price: FEATURE_PRICES_KRW.replay, charged: false });
    vi.mocked(buildReplay).mockRejectedValue(new Error('crash'));

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(500);
    expect(refund).not.toHaveBeenCalled();
  });

  it('real-gate 통합: 미잠금 + 부적 부족 → 402 end-to-end (게이트 mock 미사용)', async () => {
    const realGate = (await vi.importActual('@/lib/payments/feature-gate')) as {
      resolveFeatureCharge: typeof resolveFeatureCharge;
    };
    vi.mocked(resolveFeatureCharge).mockImplementation(realGate.resolveFeatureCharge);
    vi.mocked(isFeatureUnlocked).mockResolvedValue(false); // 실제 게이트가 호출하는 unlock 검사

    const userClient = makeUserClient({});
    const localRpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'INSUFFICIENT_TOKENS', code: 'P0001' } });
    const localService = { rpc: localRpc };
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(localService as never);

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('replay');
    expect(body.amount_krw).toBe(400);
  });

  it('500 → DB row score_breakdown에 yunse_adjustment 누락 시 INTERNAL_ERROR', async () => {
    const brokenRow = {
      ...HAPCARD_ROW,
      score_breakdown: { hap_chung_hyung_hae: 70, sipsin: 75, ohaeng: 68, mode_adjustment: 5 },
    } as unknown as HapcardResult;
    const userClient = makeUserClient({ hapcardRow: brokenRow });
    const { client: svcClient } = makeServiceClient();
    vi.mocked(createServerClient).mockResolvedValue(userClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(svcClient as never);

    const res = await POST(makeRequest({}), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(buildReplay).not.toHaveBeenCalled();
  });
});
