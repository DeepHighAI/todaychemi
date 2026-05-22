import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/hapcards/[id]/role-analysis/route';
import { mockChartCoreSelf, mockChartCoreRelation } from '../../../../../fixtures/hapcard';

const HAPCARD_ID = 'hapcard-uuid-001';
const USER_ID = 'user-uuid-001';

const STORED_ANALYSIS = {
  title: '저장된 관계 유지',
  summary: '저장된 분석을 우선 사용합니다.',
  roles: [
    { title: '상대가 나에게', sipsin: '편관', body: '저장된 역할입니다.' },
    { title: '내가 상대에게', sipsin: '편재', body: '저장된 역할입니다.' },
  ],
  areas: [
    { title: '수익 만들기', body: '저장된 영역입니다.' },
    { title: '분배 기준', body: '저장된 영역입니다.' },
    { title: '보관과 리스크', body: '저장된 영역입니다.' },
  ],
  basis: ['본인 일주 무신', '인연 일주 갑인'],
  tip: '저장된 팁입니다.',
};

const HAPCARD_ROW = {
  hapcard_id: HAPCARD_ID,
  user_id: USER_ID,
  relation_id: 'relation-uuid-001',
  mode: '돈합',
  user_chart_hash: 'user-chart-hash',
  relation_chart_hash: 'relation-chart-hash',
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
  return new Request(`http://localhost/api/hapcards/${id}/role-analysis`, {
    method: 'GET',
  }) as unknown as Parameters<typeof GET>[0];
}

function makeParams(id = HAPCARD_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/hapcards/[id]/role-analysis', () => {
  it('401 → 미인증', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('저장된 role_analysis가 있으면 chart 조회 없이 반환한다', async () => {
    const { client, userChartsChain, relationChartsChain } = makeClient({
      hapcardRow: {
        ...HAPCARD_ROW,
        content: { role_analysis: STORED_ANALYSIS },
      },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe('stored');
    expect(body.analysis).toEqual(STORED_ANALYSIS);
    expect(userChartsChain.select).not.toHaveBeenCalled();
    expect(relationChartsChain.select).not.toHaveBeenCalled();
  });

  it('저장된 분석이 없으면 chart_core 기반 규칙 분석을 반환한다', async () => {
    const { client, hapcardsChain } = makeClient({
      userChartRow: { chart_core: { ...mockChartCoreSelf, day_pillar: '戊申', day_master_element: '토' } },
      relationChartRow: { chart_core: { ...mockChartCoreRelation, day_pillar: '甲寅', day_master_element: '목' } },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe('rules');
    expect(body.analysis.title).toBe('무신 ↔ 갑인 관계 유지');
    expect(body.analysis.roles[0].sipsin).toBe('편관');
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
});
