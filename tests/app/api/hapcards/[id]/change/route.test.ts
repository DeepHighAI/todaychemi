import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/hapcards/[id]/change/route';

const HAPCARD_ID = 'hapcard-uuid-001';
const REL_ID = 'rel-uuid-001';

const BREAKDOWN_CURRENT = {
  hap_chung_hyung_hae: 30,
  sipsin: 20,
  ohaeng: 15,
  yunse_adjustment: 5,
  mode_adjustment: 5,
};
const BREAKDOWN_PREV = {
  hap_chung_hyung_hae: 26, // +4
  sipsin: 22,              // -2
  ohaeng: 15,              //  0
  yunse_adjustment: 4,     // +1
  mode_adjustment: 5,      //  0
};

// 케미카드 행 (authoritative current 값)
const HAPCARD_ROW = {
  relation_id: REL_ID,
  mode: '친구합',
  target_date: '2026-05-10',
  prompt_version: 'v0.17',
  compat_score: 75,
  score_breakdown: BREAKDOWN_CURRENT,
};

type SnapRow = {
  target_date: string;
  prompt_version: string;
  scoring_version: string;
  compat_score: number;
  score_breakdown: typeof BREAKDOWN_CURRENT;
  created_at: string;
};

const CURRENT_SNAP: SnapRow = {
  target_date: '2026-05-10',
  prompt_version: 'v0.17',
  scoring_version: '2',
  compat_score: 75,
  score_breakdown: BREAKDOWN_CURRENT,
  created_at: '2026-05-10T09:00:00Z',
};
const PREV_SNAP_SAME: SnapRow = {
  target_date: '2026-05-03',
  prompt_version: 'v0.17',
  scoring_version: '2',
  compat_score: 70,
  score_breakdown: BREAKDOWN_PREV,
  created_at: '2026-05-03T09:00:00Z',
};

function makeHapcardsChain(opts: {
  row?: typeof HAPCARD_ROW | null;
  error?: { message: string } | null;
} = {}) {
  const row = opts.row === undefined ? HAPCARD_ROW : opts.row;
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: opts.error ?? null });
  const eqChain = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eqChain });
  return { select };
}

// select→eq→eq→lte→order→order(resolve)
function makeSnapshotsChain(opts: { rows?: SnapRow[]; error?: { message: string } | null } = {}) {
  const rows = opts.rows ?? [];
  let orderCalls = 0;
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.order.mockImplementation(() => {
    orderCalls++;
    if (orderCalls < 2) return chain;
    return Promise.resolve({ data: rows, error: opts.error ?? null });
  });
  return chain;
}

function makeClient(opts: {
  userId?: string | null;
  hapcardRow?: typeof HAPCARD_ROW | null;
  hapcardError?: { message: string } | null;
  snapshotRows?: SnapRow[];
  snapshotError?: { message: string } | null;
} = {}) {
  const userId = opts.userId === undefined ? 'user-uuid-001' : opts.userId;
  const hapcardsChain = makeHapcardsChain({
    row: opts.hapcardRow === undefined ? HAPCARD_ROW : opts.hapcardRow,
    error: opts.hapcardError ?? null,
  });
  const snapshotsChain = makeSnapshotsChain({
    rows: opts.snapshotRows,
    error: opts.snapshotError,
  });

  const from = vi.fn((table: string) => {
    if (table === 'hapcards') return hapcardsChain;
    if (table === 'hapcard_score_snapshots') return snapshotsChain;
    return {};
  });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: userId ? null : { message: 'no session' },
  });

  return { client: { auth: { getUser }, from } };
}

function makeRequest() {
  return new Request(`http://localhost/api/hapcards/${HAPCARD_ID}/change`, {
    method: 'GET',
  }) as unknown as Parameters<typeof GET>[0];
}

function makeParams(id = HAPCARD_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('GET /api/hapcards/[id]/change — auth & 조회', () => {
  it('401 → 미인증', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('404 → 케미카드 미존재 또는 RLS 차단', async () => {
    const { client } = makeClient({ hapcardRow: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('HAPCARD_NOT_FOUND');
  });

  it('500 → 케미카드 조회 오류', async () => {
    const { client } = makeClient({ hapcardRow: null, hapcardError: { message: 'boom' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL_ERROR');
  });

  it('500 → 스냅샷 조회 오류', async () => {
    const { client } = makeClient({ snapshotError: { message: 'snap boom' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL_ERROR');
  });
});

describe('GET /api/hapcards/[id]/change — status', () => {
  it('first → 직전 해석(더 오래된 날짜) 없음', async () => {
    // 현재 날짜 스냅샷만 존재, 더 오래된 행 없음
    const { client } = makeClient({ snapshotRows: [CURRENT_SNAP] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('first');
    expect(body.delta).toBeNull();
    expect(body.factors).toEqual([]);
  });

  it('first → 스냅샷 0건', async () => {
    const { client } = makeClient({ snapshotRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.status).toBe('first');
  });

  it('version_changed → 직전 스냅샷 scoring_version 불일치 (ADR-036)', async () => {
    const prevOldScoring: SnapRow = { ...PREV_SNAP_SAME, scoring_version: '1' };
    const { client } = makeClient({ snapshotRows: [CURRENT_SNAP, prevOldScoring] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.status).toBe('version_changed');
    expect(body.delta).toBeNull();
    expect(body.factors).toEqual([]);
  });

  it('version_changed → 직전 스냅샷 prompt_version 불일치 (ADR-036)', async () => {
    const prevOldPrompt: SnapRow = { ...PREV_SNAP_SAME, prompt_version: 'v0.16' };
    const { client } = makeClient({ snapshotRows: [CURRENT_SNAP, prevOldPrompt] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.status).toBe('version_changed');
  });

  it('comparable → delta + 변화 요인 (card 행 기준 current)', async () => {
    const { client } = makeClient({ snapshotRows: [CURRENT_SNAP, PREV_SNAP_SAME] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.status).toBe('comparable');
    expect(body.delta).toBe(5); // card 75 - prev 70
    // abs delta 내림차순 top 3: hap +4, sipsin -2, yunse +1 (ohaeng·mode 0 제외)
    expect(body.factors).toEqual([
      { factor: 'hap_chung_hyung_hae', delta: 4 },
      { factor: 'sipsin', delta: -2 },
      { factor: 'yunse_adjustment', delta: 1 },
    ]);
  });

  it('comparable → current 점수는 스냅샷이 아닌 card 행에서 (표시 점수 일치)', async () => {
    // 현재 스냅샷 compat_score 가 card 와 다르게 stale 해도 card 행을 신뢰
    const staleCurrent: SnapRow = { ...CURRENT_SNAP, compat_score: 99 };
    const { client } = makeClient({ snapshotRows: [staleCurrent, PREV_SNAP_SAME] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.delta).toBe(5); // card 75 - prev 70, NOT 99 - 70
  });
});
