import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/relations/[id]/memos/route';

const REL_ID = 'rel-uuid-001';
const USER_ID = 'user-uuid-001';

const MEMO_ROW = {
  memo_id: 'memo-uuid-001',
  relation_id: REL_ID,
  body: '좋은 인연',
  created_at: '2026-05-28T09:00:00Z',
  updated_at: '2026-05-28T09:00:00Z',
};

// GET 체인 빌더
function makeMemosSelectChain(rows: typeof MEMO_ROW[] | null, error: { message: string } | null = null) {
  const orderChain = vi.fn().mockResolvedValue({ data: rows, error });
  const eqChain = vi.fn().mockReturnValue({ order: orderChain });
  const select = vi.fn().mockReturnValue({ eq: eqChain });
  return { select, orderChain, eqChain };
}

// POST — 인연 pre-check 체인
function makeRelationCheckChain(
  row: { relation_id: string } | null,
  error: { message: string } | null = null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
  const eqChain = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eqChain });
  return { select };
}

// POST — insert 체인
function makeInsertChain(row: typeof MEMO_ROW | null, error: { message: string } | null = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert };
}

function makeClient(opts: {
  userId?: string | null;
  memoRows?: typeof MEMO_ROW[];
  memoError?: { message: string } | null;
  relationRow?: { relation_id: string } | null;
  relationError?: { message: string } | null;
  insertRow?: typeof MEMO_ROW | null;
  insertError?: { message: string } | null;
} = {}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const memosChain = makeMemosSelectChain(
    opts.memoRows ?? [MEMO_ROW],
    opts.memoError ?? null,
  );
  const relCheckChain = makeRelationCheckChain(
    opts.relationRow === undefined ? { relation_id: REL_ID } : opts.relationRow,
    opts.relationError ?? null,
  );
  const insertChain = makeInsertChain(
    opts.insertRow === undefined ? MEMO_ROW : opts.insertRow,
    opts.insertError ?? null,
  );

  const from = vi.fn((table: string) => {
    if (table === 'relation_memos') {
      // GET 경로에서는 select; POST 경로에서는 insert
      return { ...memosChain, ...insertChain };
    }
    if (table === 'relations') return relCheckChain;
    return {};
  });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  return { client: { auth: { getUser }, from } };
}

function makeGetRequest(id = REL_ID) {
  return new Request(`http://localhost/api/relations/${id}/memos`, {
    method: 'GET',
  }) as unknown as Parameters<typeof GET>[0];
}

function makePostRequest(body: unknown, id = REL_ID) {
  return new Request(`http://localhost/api/relations/${id}/memos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function makeParams(id = REL_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

// ─── GET ────────────────────────────────────────────────────────────────────

describe('GET /api/relations/[id]/memos — auth', () => {
  it('401 → 미인증', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/relations/[id]/memos — 목록 조회', () => {
  it('200 → items 배열 반환', async () => {
    const { client } = makeClient({ memoRows: [MEMO_ROW] });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].memo_id).toBe('memo-uuid-001');
    expect(body.items[0]).not.toHaveProperty('user_id'); // user_id 미노출
  });

  it('created_at asc 정렬로 조회', async () => {
    const { client } = makeClient({ memoRows: [] });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await GET(makeGetRequest(), makeParams());

    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls;
    const memoFromCall = fromCalls.find((c: string[]) => c[0] === 'relation_memos');
    expect(memoFromCall).toBeTruthy();
    // orderChain이 호출될 때 ascending:true 를 받아야 함
    const memoChain = makeMemosSelectChain([]);
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === 'relation_memos') return memoChain;
        return {};
      }),
    } as never);
    await GET(makeGetRequest(), makeParams());
    expect(memoChain.orderChain).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('200 → 0건이면 빈 배열', async () => {
    const { client } = makeClient({ memoRows: [] });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('500 → DB 오류', async () => {
    const { client } = makeClient({ memoRows: [], memoError: { message: 'db error' } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ─── POST ───────────────────────────────────────────────────────────────────

describe('POST /api/relations/[id]/memos — 입력 검증', () => {
  it('400 → body 없음', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new Request('http://localhost/api/relations/rel-001/memos', {
      method: 'POST',
      body: 'not-json',
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('400 → body 빈 문자열', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(makePostRequest({ body: '' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('400 → body 81자', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(makePostRequest({ body: 'a'.repeat(81) }), makeParams());
    expect(res.status).toBe(400);
  });

  it('400 → 추가 필드 (strict)', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(makePostRequest({ body: '안녕', extra: 'x' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('401 → 미인증 (insert 미호출)', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(makePostRequest({ body: '안녕' }), makeParams());

    expect(res.status).toBe(401);
    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls;
    const insertCall = fromCalls.find((c: string[]) => c[0] === 'relation_memos');
    expect(insertCall).toBeUndefined(); // insert 미호출
  });
});

describe('POST /api/relations/[id]/memos — 생성', () => {
  it('404 → 인연 미존재 (RLS 차단)', async () => {
    const { client } = makeClient({ relationRow: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(makePostRequest({ body: '안녕' }), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('RELATION_NOT_FOUND');
  });

  it('500 → 인연 pre-check 조회 오류는 404 not found 로 위장하지 않는다', async () => {
    const { client } = makeClient({
      relationRow: null,
      relationError: { message: 'relation lookup failed' },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(makePostRequest({ body: '안녕' }), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('200 → 메모 생성 성공 (user_id·relation_id·body 포함)', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(makePostRequest({ body: '좋은 인연' }), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.memo.memo_id).toBe('memo-uuid-001');
    expect(body.memo.body).toBe('좋은 인연');
    expect(body.memo).not.toHaveProperty('user_id');
  });

  it('500 → insert 오류', async () => {
    const { client } = makeClient({ insertError: { message: 'insert failed' } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(makePostRequest({ body: '안녕' }), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
