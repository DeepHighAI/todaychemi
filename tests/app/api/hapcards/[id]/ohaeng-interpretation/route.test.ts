import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/payments/feature-unlock');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { isFeatureUnlocked } from '@/lib/payments/feature-unlock';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { GET } from '@/app/api/hapcards/[id]/ohaeng-interpretation/route';
import { mockChartCoreSelf, mockChartCoreRelation } from '../../../../../fixtures/hapcard';

const HAPCARD_ID = 'hapcard-uuid-001';
const USER_ID = 'user-uuid-001';

const STORED_INTERPRETATION = {
  title: '저장된 오행 해석',
  summary: '저장된 해석을 우선 사용합니다.',
  points: [
    { label: '중심 기질', body: '저장된 중심 기질입니다.' },
    { label: '균형 포인트', body: '저장된 균형 포인트입니다.' },
    { label: '관계 흐름', body: '저장된 관계 흐름입니다.' },
  ],
  tip: '저장된 팁입니다.',
};

const HAPCARD_CACHE_KEY = 'hapcard-cache-key-001';

const HAPCARD_ROW = {
  hapcard_id: HAPCARD_ID,
  user_id: USER_ID,
  relation_id: 'relation-uuid-001',
  mode: '돈합',
  user_chart_hash: 'user-chart-hash',
  relation_chart_hash: 'relation-chart-hash',
  cache_key: HAPCARD_CACHE_KEY,
  content: {},
};

function makeChain(data: unknown, error: { message: string } | null = null) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

function makeClient(opts: {
  userId?: string | null;
  hapcardRow?: unknown;
  userChartRow?: unknown;
  relationChartRow?: unknown;
} = {}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const hapcardsChain = makeChain(opts.hapcardRow === undefined ? HAPCARD_ROW : opts.hapcardRow);
  const userChartsChain = makeChain(opts.userChartRow === undefined ? { chart_core: mockChartCoreSelf } : opts.userChartRow);
  const relationChartsChain = makeChain(
    opts.relationChartRow === undefined ? { chart_core: mockChartCoreRelation } : opts.relationChartRow,
  );

  const from = vi.fn((table: string) => {
    if (table === 'hapcards') return hapcardsChain;
    if (table === 'user_charts') return userChartsChain;
    if (table === 'relation_charts') return relationChartsChain;
    return makeChain(null);
  });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  return {
    client: { auth: { getUser }, from },
    hapcardsChain,
    userChartsChain,
    relationChartsChain,
  };
}

function makeRequest(id = HAPCARD_ID) {
  return new Request(`http://localhost/api/hapcards/${id}/ohaeng-interpretation`, {
    method: 'GET',
  }) as unknown as Parameters<typeof GET>[0];
}

function makeParams(id = HAPCARD_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // 기본값: 잠금 해제됨(결제/무료차감 완료) — 기존 happy-path 케이스 유지.
  vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
  vi.mocked(isFeatureUnlocked).mockResolvedValue(true);
});

describe('GET /api/hapcards/[id]/ohaeng-interpretation', () => {
  it('401 → 미인증', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('저장된 ohaeng_interpretation이 있으면 chart 조회 없이 반환한다', async () => {
    const { client, userChartsChain, relationChartsChain } = makeClient({
      hapcardRow: {
        ...HAPCARD_ROW,
        content: { ohaeng_interpretation: STORED_INTERPRETATION },
      },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe('stored');
    expect(body.interpretation).toEqual(STORED_INTERPRETATION);
    expect(userChartsChain.select).not.toHaveBeenCalled();
    expect(relationChartsChain.select).not.toHaveBeenCalled();
  });

  it('저장된 해석이 없으면 chart_core 기반 규칙 해석을 반환한다', async () => {
    const { client, hapcardsChain } = makeClient();
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe('rules');
    expect(body.interpretation.title).toContain('갑인 ↔ 병오');
    expect(body.interpretation.points).toHaveLength(3);
    expect(hapcardsChain.eq).toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('hapcard가 없으면 404를 반환한다', async () => {
    const { client } = makeClient({ hapcardRow: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('HAPCARD_NOT_FOUND');
  });

  it('미결제(잠금 미해제) → 402, 본문(interpretation) 미포함', async () => {
    // content 에 본문이 저장돼 있어도 잠금 미해제면 유출되면 안 된다.
    const { client } = makeClient({
      hapcardRow: { ...HAPCARD_ROW, content: { ohaeng_interpretation: STORED_INTERPRETATION } },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    vi.mocked(isFeatureUnlocked).mockResolvedValue(false);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('hapcard');
    expect(body.ref).toBe(HAPCARD_CACHE_KEY);
    expect(body.amount_krw).toBe(FEATURE_PRICES_KRW.hapcard.amount_krw);
    // 본문 유출 차단 — 응답에 해석 본문이 실리면 안 된다.
    expect(body.interpretation).toBeUndefined();
    // 게이트는 hapcard cache_key 로 평가한다.
    expect(isFeatureUnlocked).toHaveBeenCalledWith(expect.anything(), USER_ID, 'hapcard', HAPCARD_CACHE_KEY);
  });
});
