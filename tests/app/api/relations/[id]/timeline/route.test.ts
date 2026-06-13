import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/relations/[id]/timeline/route';

const REL_ID = 'rel-uuid-001';
const USER_ID = 'user-uuid-001';

const RELATION_ROW = {
  relation_id: REL_ID,
  created_at: '2026-05-01T00:00:00Z',
};

type CardRow = { hapcard_id: string; mode: string; created_at: string };
type ReplayRow = { replay_id: string; hapcard_id: string; created_at: string };

const CARD_ROWS: CardRow[] = [
  { hapcard_id: 'card-1', mode: '친구합', created_at: '2026-05-10T09:00:00Z' },
  { hapcard_id: 'card-2', mode: '썸합', created_at: '2026-06-01T09:00:00Z' },
];

const REPLAY_ROWS: ReplayRow[] = [
  { replay_id: 'replay-1', hapcard_id: 'card-1', created_at: '2026-05-20T09:00:00Z' },
];

// 체인 빌더 헬퍼
function makeRelationsChain(
  row: typeof RELATION_ROW | null,
  error: { message: string } | null = null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
  const eqChain = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eqChain });
  return { select };
}

function makeCardsChain(rows: CardRow[] | null, error: { message: string } | null = null) {
  const eqChain = vi.fn().mockResolvedValue({ data: rows, error });
  const select = vi.fn().mockReturnValue({ eq: eqChain });
  return { select };
}

function makeReplaysChain(rows: ReplayRow[] | null, error: { message: string } | null = null) {
  const inChain = vi.fn().mockResolvedValue({ data: rows, error });
  const select = vi.fn().mockReturnValue({ in: inChain });
  return { select, inChain };
}

function makeClient(opts: {
  userId?: string | null;
  relationRow?: typeof RELATION_ROW | null;
  relationError?: { message: string } | null;
  cardRows?: CardRow[] | null;
  cardError?: { message: string } | null;
  replayRows?: ReplayRow[] | null;
  replayError?: { message: string } | null;
} = {}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const relChain = makeRelationsChain(
    opts.relationRow === undefined ? RELATION_ROW : opts.relationRow,
    opts.relationError ?? null,
  );
  const cardsChain = makeCardsChain(
    opts.cardRows === undefined ? CARD_ROWS : opts.cardRows,
    opts.cardError ?? null,
  );
  const replaysChain = makeReplaysChain(
    opts.replayRows === undefined ? REPLAY_ROWS : opts.replayRows,
    opts.replayError ?? null,
  );

  const from = vi.fn((table: string) => {
    if (table === 'relations') return relChain;
    if (table === 'hapcards') return cardsChain;
    if (table === 'hapcard_replays') return replaysChain;
    return {};
  });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  return { client: { auth: { getUser }, from }, replaysChain, from };
}

function makeRequest(id = REL_ID) {
  return new Request(`http://localhost/api/relations/${id}/timeline`, {
    method: 'GET',
  }) as unknown as Parameters<typeof GET>[0];
}

function makeParams(id = REL_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('GET /api/relations/[id]/timeline — auth', () => {
  it('401 → 미인증 (user null)', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/relations/[id]/timeline — relation 조회', () => {
  it('404 → 인연 미존재 또는 RLS 차단', async () => {
    const { client } = makeClient({ relationRow: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('RELATION_NOT_FOUND');
  });

  it('500 → relations 조회 오류는 404 로 위장하지 않는다', async () => {
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
});

describe('GET /api/relations/[id]/timeline — 이벤트 병합', () => {
  it('200 → 등록·케미카드·다시맞추기 병합, 최신순(desc), 등록이 마지막', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(4);
    expect(body.events.map((e: { type: string }) => e.type)).toEqual([
      'hapcard',    // 2026-06-01 card-2
      'replay',     // 2026-05-20 replay-1
      'hapcard',    // 2026-05-10 card-1
      'registered', // 2026-05-01 등록
    ]);
    expect(body.events[0].occurred_at).toBe('2026-06-01T09:00:00Z');
    expect(body.events.at(-1)).toEqual({
      type: 'registered',
      occurred_at: '2026-05-01T00:00:00Z',
      mode: null,
    });
  });

  it('replay 이벤트는 소속 케미카드의 mode 를 갖는다', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    const replay = body.events.find((e: { type: string }) => e.type === 'replay');
    expect(replay.mode).toBe('친구합');
  });

  it('케미카드 0건 → replay 쿼리 생략, 등록 이벤트만 반환', async () => {
    const { client, replaysChain } = makeClient({ cardRows: [] });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.events).toEqual([
      { type: 'registered', occurred_at: '2026-05-01T00:00:00Z', mode: null },
    ]);
    expect(replaysChain.select).not.toHaveBeenCalled();
  });

  it('이벤트에 본문·점수·PII 필드 미포함 (메타데이터만)', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    for (const event of body.events) {
      expect(Object.keys(event).sort()).toEqual(['mode', 'occurred_at', 'type']);
    }
  });

  it('이벤트 상한 50건 초과 시 최신 50건 + 등록 이벤트는 항상 포함', async () => {
    const manyCards: CardRow[] = Array.from({ length: 60 }, (_, i) => ({
      hapcard_id: `card-${i}`,
      mode: '친구합',
      created_at: `2026-05-15T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
    }));
    const { client } = makeClient({ cardRows: manyCards, replayRows: [] });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.events).toHaveLength(51);
    expect(body.events.at(-1).type).toBe('registered');
    // 최신순 유지 — 첫 이벤트가 가장 늦은 시각
    expect(body.events[0].occurred_at).toBe('2026-05-15T00:59:00Z');
  });

  it('500 → hapcards 조회 오류', async () => {
    const { client } = makeClient({ cardError: { message: 'cards lookup failed' } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('500 → hapcard_replays 조회 오류', async () => {
    const { client } = makeClient({ replayError: { message: 'replays lookup failed' } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
