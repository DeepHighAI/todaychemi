import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient } from '@/lib/supabase/server';
import { GET, PATCH } from '@/app/api/relations/[id]/route';

const REL_ID = 'rel-uuid-001';
const USER_ID = 'user-uuid-001';

const RELATION_ROW = {
  relation_id: REL_ID,
  nickname: '봄달',
  mode: '친구합',
  created_at: '2026-05-01T00:00:00Z',
};

const CHART_ROW = {
  chart_core: {
    year_pillar: '갑자',
    month_pillar: '을축',
    day_pillar: '병인',
    hour_pillar: null,
    day_master_element: '화',
    five_elements_counts: { 목: 1, 화: 2, 토: 1, 금: 0, 수: 1 },
    gender_normalized: 'F',
    yunse: {},
  },
};

type SnapRow = { target_date: string; compat_score: number; created_at: string };

// 체인 빌더 헬퍼
function makeRelationsChain(
  row: typeof RELATION_ROW | null,
  error: { message: string } | null = null,
  updateRow: typeof RELATION_ROW | null = row,
  updateError: { message: string } | null = null,
) {
  const maybySingle = vi.fn().mockResolvedValue({ data: row, error });
  const eqChain = vi.fn().mockReturnValue({ maybeSingle: maybySingle });
  const select = vi.fn().mockReturnValue({ eq: eqChain });
  const updateMaybeSingle = vi.fn().mockResolvedValue({ data: updateRow, error: updateError });
  const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  return { select, update, updateEq, updateSelect, updateMaybeSingle };
}

function makeRelationChartsChain(
  row: typeof CHART_ROW | null,
  error: { message: string } | null = null,
) {
  const maybySingle = vi.fn().mockResolvedValue({ data: row, error });
  const limitChain = vi.fn().mockReturnValue({ maybeSingle: maybySingle });
  const orderChain = vi.fn().mockReturnValue({ limit: limitChain });
  const eqChain = vi.fn().mockReturnValue({ order: orderChain });
  const select = vi.fn().mockReturnValue({ eq: eqChain });
  return { select };
}

function makeSnapshotsChain(rows: SnapRow[], error: { message: string } | null = null) {
  let orderCalls = 0;
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.order.mockImplementation(() => {
    orderCalls++;
    if (orderCalls < 2) return chain;
    return Promise.resolve({ data: rows, error });
  });
  return chain;
}

function makeClient(opts: {
  userId?: string | null;
  relationRow?: typeof RELATION_ROW | null;
  relationError?: { message: string } | null;
  updateRelationRow?: typeof RELATION_ROW | null;
  updateRelationError?: { message: string } | null;
  chartRow?: typeof CHART_ROW | null;
  chartError?: { message: string } | null;
  snapRows?: SnapRow[];
  snapError?: { message: string } | null;
} = {}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const relChain = makeRelationsChain(
    opts.relationRow === undefined ? RELATION_ROW : opts.relationRow,
    opts.relationError ?? null,
    opts.updateRelationRow === undefined ? RELATION_ROW : opts.updateRelationRow,
    opts.updateRelationError ?? null,
  );
  const chartChain = makeRelationChartsChain(
    opts.chartRow === undefined ? CHART_ROW : opts.chartRow,
    opts.chartError ?? null,
  );
  const snapChain = makeSnapshotsChain(opts.snapRows ?? [], opts.snapError ?? null);

  const from = vi.fn((table: string) => {
    if (table === 'relations') return relChain;
    if (table === 'relation_charts') return chartChain;
    if (table === 'hapcard_score_snapshots') return snapChain;
    return {};
  });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  return { client: { auth: { getUser }, from }, relChain, snapChain };
}

function makeRequest(id = REL_ID) {
  return new Request(`http://localhost/api/relations/${id}`, {
    method: 'GET',
  }) as unknown as Parameters<typeof GET>[0];
}

function makePatchRequest(body: unknown, id = REL_ID) {
  return new Request(`http://localhost/api/relations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
}

function makeParams(id = REL_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('GET /api/relations/[id] — auth', () => {
  it('401 → 미인증 (user null)', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/relations/[id] — relation 조회', () => {
  it('404 → 인연 미존재 또는 RLS 차단', async () => {
    const { client } = makeClient({ relationRow: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('RELATION_NOT_FOUND');
  });

  it('500 → relations 조회 오류는 404 not found 로 위장하지 않는다', async () => {
    const { client } = makeClient({
      relationRow: null,
      relationError: { message: 'relation lookup failed' },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('200 → relation 필드 반환 (relation_id·nickname·mode·created_at)', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.relation.relation_id).toBe(REL_ID);
    expect(body.relation.nickname).toBe('봄달');
    expect(body.relation.mode).toBe('친구합');
    expect(body.relation).not.toHaveProperty('birth_date');   // PII 필드 미포함
  });
});

describe('GET /api/relations/[id] — chart', () => {
  it('chart: ChartCore — relation_charts 존재 시 반환', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chart).not.toBeNull();
    expect(body.chart.day_pillar).toBe('병인');
  });

  it('chart: null — relation_charts 0건이면 null', async () => {
    const { client } = makeClient({ chartRow: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chart).toBeNull();
  });

  it('500 → relation_charts 조회 오류는 chart:null 로 위장하지 않는다', async () => {
    const { client } = makeClient({ chartError: { message: 'chart lookup failed' } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('GET /api/relations/[id] — flow', () => {
  it('flow: 0건이면 빈 배열', async () => {
    const { client } = makeClient({ snapRows: [] });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flow).toEqual([]);
  });

  it('flow: 날짜 asc 정렬, score 값 포함', async () => {
    const rows: SnapRow[] = [
      { target_date: '2026-05-01', compat_score: 60, created_at: '2026-05-01T10:00:00Z' },
      { target_date: '2026-05-02', compat_score: 70, created_at: '2026-05-02T10:00:00Z' },
    ];
    const { client } = makeClient({ snapRows: rows });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.flow[0]).toEqual({ date: '2026-05-01', score: 60 });
    expect(body.flow[1]).toEqual({ date: '2026-05-02', score: 70 });
  });

  it('flow: 같은 날짜 중복 행 → 최신 created_at 1건만 (dedup)', async () => {
    const rows: SnapRow[] = [
      { target_date: '2026-05-01', compat_score: 75, created_at: '2026-05-01T12:00:00Z' }, // 최신
      { target_date: '2026-05-01', compat_score: 60, created_at: '2026-05-01T08:00:00Z' }, // 구버전
    ];
    const { client } = makeClient({ snapRows: rows });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.flow).toHaveLength(1);
    expect(body.flow[0].score).toBe(75);
  });

  it('flow: 30개 상한 초과 행 → 30개만 반환', async () => {
    const rows: SnapRow[] = Array.from({ length: 35 }, (_, i) => ({
      target_date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      compat_score: 50 + i,
      created_at: `2026-04-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    }));
    const { client } = makeClient({ snapRows: rows });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.flow).toHaveLength(30);
  });

  it('flow: 30개 상한 초과 행 → 최신 30개를 asc 로 반환해 현재 점수를 보존한다', async () => {
    const rows: SnapRow[] = Array.from({ length: 35 }, (_, i) => ({
      target_date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      compat_score: 50 + i,
      created_at: `2026-04-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    }));
    const { client } = makeClient({ snapRows: rows });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.flow).toHaveLength(30);
    expect(body.flow[0]).toEqual({ date: '2026-04-06', score: 55 });
    expect(body.flow.at(-1)).toEqual({ date: '2026-04-35', score: 84 });
  });

  it('flow: 같은 날짜 행 순서가 섞여도 created_at 최신 score 를 선택한다', async () => {
    const rows: SnapRow[] = [
      { target_date: '2026-05-01', compat_score: 60, created_at: '2026-05-01T08:00:00Z' },
      { target_date: '2026-05-01', compat_score: 75, created_at: '2026-05-01T12:00:00Z' },
    ];
    const { client } = makeClient({ snapRows: rows });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.flow).toEqual([{ date: '2026-05-01', score: 75 }]);
  });

  it('500 → hapcard_score_snapshots 조회 오류', async () => {
    const { client } = makeClient({ snapError: { message: 'db error' } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('PATCH /api/relations/[id] — 별명 수정', () => {
  it('401 → 미인증 (user null)', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ nickname: '새별명' }), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('400 → 빈 별명 또는 20자 초과 별명은 거부한다', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const empty = await PATCH(makePatchRequest({ nickname: '   ' }), makeParams());
    const tooLong = await PATCH(makePatchRequest({ nickname: '가'.repeat(21) }), makeParams());

    expect(empty.status).toBe(400);
    expect((await empty.json()).error.code).toBe('INVALID_BODY');
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error.code).toBe('INVALID_BODY');
  });

  it('400 → nickname 외 PII 필드가 섞인 body 는 거부한다', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(
      makePatchRequest({ nickname: '새별명', birth_date: '1990-01-01' }),
      makeParams(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('200 → 별명을 trim 해서 저장하고 relation 필드만 반환한다', async () => {
    const updated = { ...RELATION_ROW, nickname: '새별명' };
    const { client, relChain } = makeClient({ updateRelationRow: updated });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ nickname: '  새별명  ' }), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.relation.nickname).toBe('새별명');
    expect(body.relation).not.toHaveProperty('birth_date');
    expect(relChain.update).toHaveBeenCalledWith({ nickname: '새별명' });
    expect(relChain.updateEq).toHaveBeenCalledWith('relation_id', REL_ID);
  });

  it('404 → update 결과가 없으면 인연 미존재로 응답한다', async () => {
    const { client } = makeClient({ updateRelationRow: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ nickname: '새별명' }), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('RELATION_NOT_FOUND');
  });

  it('500 → update 오류는 internal error 로 응답한다', async () => {
    const { client } = makeClient({
      updateRelationRow: null,
      updateRelationError: { message: 'update failed' },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ nickname: '새별명' }), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
