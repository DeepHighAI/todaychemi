import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/hapcards/[id]/snapshots/route';

const HAPCARD_ID = 'hapcard-uuid-001';
// 2026-05-10T01:00:00Z = 2026-05-10T10:00:00+09:00 (KST)
const FIXED_UTC = new Date('2026-05-10T01:00:00.000Z');
const TODAY = '2026-05-10';
const D_MINUS_3 = '2026-05-07';
const D_PLUS_3 = '2026-05-13';

const HAPCARD_ROW = { relation_id: 'rel-uuid-001', mode: '친구합' };

type SnapRow = { target_date: string; compat_score: number; created_at: string };

function makeSnapshotsChain(opts: {
  rows?: SnapRow[];
  error?: { message: string } | null;
} = {}) {
  const rows = opts.rows ?? [];
  let orderCalls = 0;
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.order.mockImplementation(() => {
    orderCalls++;
    if (orderCalls < 2) return chain;
    return Promise.resolve({ data: rows, error: opts.error ?? null });
  });
  return chain;
}

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
    error: null,
  });

  return { client: { auth: { getUser }, from }, snapshotsChain };
}

function makeRequest(id = HAPCARD_ID) {
  return new Request(`http://localhost/api/hapcards/${id}/snapshots`, {
    method: 'GET',
  }) as unknown as Parameters<typeof GET>[0];
}

function makeParams(id = HAPCARD_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_UTC);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/hapcards/[id]/snapshots — auth + RLS + range', () => {
  it('401 → 미인증 (getUser null)', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('404 → hapcard 미존재 (RLS 차단)', async () => {
    const { client } = makeClient({ hapcardRow: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('HAPCARD_NOT_FOUND');
  });

  it('500 → hapcard 조회 오류는 404 not found 로 위장하지 않는다', async () => {
    const { client } = makeClient({
      hapcardRow: null,
      hapcardError: { message: 'hapcard lookup failed' },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('range: gte target_date D-3, lte D+3, 응답 7개 entries + 날짜 정확', async () => {
    const { client, snapshotsChain } = makeClient({
      snapshotRows: [
        { target_date: TODAY, compat_score: 75, created_at: '2026-05-10T01:00:00Z' },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(snapshotsChain.gte).toHaveBeenCalledWith('target_date', D_MINUS_3);
    expect(snapshotsChain.lte).toHaveBeenCalledWith('target_date', D_PLUS_3);

    const body = await res.json();
    expect(body.snapshots).toHaveLength(7);
    expect(body.snapshots[0].date).toBe(D_MINUS_3);
    expect(body.snapshots[3].date).toBe(TODAY);
    expect(body.snapshots[6].date).toBe(D_PLUS_3);
  });
});

describe('GET /api/hapcards/[id]/snapshots — today_index + empty + error', () => {
  it('today_index: 응답에 today_index === 3', async () => {
    const { client } = makeClient({ snapshotRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.today_index).toBe(3);
  });

  it('empty: 스냅샷 0건 → 7칸 모두 score:null, today_index 3', async () => {
    const { client } = makeClient({ snapshotRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshots).toHaveLength(7);
    expect(body.snapshots.every((s: { score: number | null }) => s.score === null)).toBe(true);
    expect(body.today_index).toBe(3);
  });

  it('error: snapshot select 오류 → 500 INTERNAL_ERROR', async () => {
    const { client } = makeClient({
      snapshotError: { message: 'db connection failed' },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
