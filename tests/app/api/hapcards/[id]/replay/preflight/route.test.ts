import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/payments/feature-unlock');
vi.mock('@/lib/payments/cash-gen-limit');
vi.mock('@/lib/today/kst-date');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { isFeatureUnlocked } from '@/lib/payments/feature-unlock';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { todayKST } from '@/lib/today/kst-date';
import { GET } from '@/app/api/hapcards/[id]/replay/preflight/route';
import type { HapcardResult, HapcardReplayResult } from '@/types/hapcard';

const HAPCARD_ID = 'hapcard-uuid-001';
const USER_ID = 'user-uuid-001';
const TODAY = '2026-06-22';
const REF = `replay:${HAPCARD_ID}:${TODAY}`;

const HAPCARD_ROW: HapcardResult = {
  hapcard_id: HAPCARD_ID,
  user_id: USER_ID,
  relation_id: 'relation-uuid-001',
  mode: '일합',
  target_date: '2026-06-22',
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
  created_at: '2026-06-01T00:00:00Z',
};

const REPLAY_ROW: HapcardReplayResult = {
  ...HAPCARD_ROW,
  replay_id: 'replay-uuid-001',
  jinjin_date: TODAY,
  created_at: '2026-06-22T01:00:00Z',
};

function makeUserClient(opts: {
  userId?: string | null;
  hapcardRow?: HapcardResult | null;
  idempotencyRow?: HapcardReplayResult | null;
} = {}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const hapcardRow = opts.hapcardRow === undefined ? HAPCARD_ROW : opts.hapcardRow;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  const hapcardMaybe = vi.fn().mockResolvedValue({ data: hapcardRow, error: null });
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
    return { select: vi.fn() };
  });

  return { auth: { getUser }, from };
}

function makeServiceClient(balance: number | null) {
  const tokenMaybeSingle = vi.fn().mockResolvedValue({
    data: balance === null ? null : { balance_after: balance },
    error: null,
  });
  const tokenChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: tokenMaybeSingle,
  };
  const from = vi.fn((table: string) => {
    if (table === 'token_ledger') return tokenChain;
    return { select: vi.fn() };
  });

  return { client: { from } as never, from, tokenMaybeSingle };
}

function makeRequest() {
  return new Request(`http://localhost/api/hapcards/${HAPCARD_ID}/replay/preflight`) as Parameters<typeof GET>[0];
}

function makeParams(id = HAPCARD_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(todayKST).mockReturnValue(TODAY);
  vi.mocked(isFeatureUnlocked).mockResolvedValue(false);
  vi.mocked(checkCashGenLimit).mockResolvedValue({ allowed: true, count: 0, limit: 5 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/hapcards/[id]/replay/preflight', () => {
  it('부적 부족 → LLM 생성 없이 즉시 PAYMENT_REQUIRED 정보를 반환한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeUserClient() as never);
    const { client, from } = makeServiceClient(0);
    vi.mocked(createServiceRoleClient).mockReturnValue(client);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      mode: 'pay_required',
      payment: {
        feature: 'replay',
        ref: REF,
        amount_krw: FEATURE_PRICES_KRW.replay.amount_krw,
      },
    });
    expect(from).toHaveBeenCalledWith('token_ledger');
    expect(checkCashGenLimit).toHaveBeenCalledWith(client, USER_ID);
  });

  it('사용 가능한 부적이 충분하면 바로 replay POST 할 수 있게 ready 를 반환한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeUserClient() as never);
    const { client } = makeServiceClient(FEATURE_PRICES_KRW.replay.token_cost);
    vi.mocked(createServiceRoleClient).mockReturnValue(client);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ mode: 'ready', payment: null });
  });

  it('이미 결제됐지만 replay row 가 없으면 추가 결제 없이 ready 를 반환한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeUserClient() as never);
    const { client, from } = makeServiceClient(0);
    vi.mocked(createServiceRoleClient).mockReturnValue(client);
    vi.mocked(isFeatureUnlocked).mockResolvedValue(true);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ mode: 'ready', payment: null });
    expect(from).not.toHaveBeenCalledWith('token_ledger');
  });

  it('선생성 replay row 가 있지만 미결제면 잔액 조회 없이 결제 필요를 반환한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeUserClient({ idempotencyRow: REPLAY_ROW }) as never);
    const { client, from } = makeServiceClient(FEATURE_PRICES_KRW.replay.token_cost);
    vi.mocked(createServiceRoleClient).mockReturnValue(client);
    vi.mocked(isFeatureUnlocked).mockResolvedValue(false);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('pay_required');
    expect(body.payment.ref).toBe(REF);
    expect(from).not.toHaveBeenCalledWith('token_ledger');
  });

  it('새 replay 생성 전 LLM outage 중이면 결제 필요를 반환하지 않는다', async () => {
    vi.stubEnv('LLM_ALL_PROVIDERS_DOWN', 'true');
    vi.mocked(createServerClient).mockResolvedValue(makeUserClient() as never);
    const { client } = makeServiceClient(0);
    vi.mocked(createServiceRoleClient).mockReturnValue(client);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('REPLAY_DURING_OUTAGE');
  });
});
