import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient } from '@/lib/supabase/server';
import { PATCH, DELETE } from '@/app/api/memos/[memoId]/route';

const MEMO_ID = 'memo-uuid-001';
const USER_ID = 'user-uuid-001';

const UPDATED_ROW = {
  memo_id: MEMO_ID,
  relation_id: 'rel-uuid-001',
  body: '수정된 메모',
  created_at: '2026-05-28T09:00:00Z',
  updated_at: '2026-05-28T10:00:00Z',
};

// PATCH — update 체인 빌더
function makeUpdateChain(row: typeof UPDATED_ROW | null, error: { message: string } | null = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error });
  const select = vi.fn().mockReturnValue({ single });
  const eqChain = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq: eqChain });
  return { update, eqChain };
}

// DELETE — delete 체인 빌더
function makeDeleteChain(count = 1, error: { message: string } | null = null) {
  const eqChain = vi.fn().mockResolvedValue({ count, error });
  const del = vi.fn().mockReturnValue({ eq: eqChain });
  return { delete: del };
}

function makeClient(opts: {
  userId?: string | null;
  updateRow?: typeof UPDATED_ROW | null;
  updateError?: { message: string } | null;
  deleteCount?: number;
  deleteError?: { message: string } | null;
} = {}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const updateChain = makeUpdateChain(
    opts.updateRow === undefined ? UPDATED_ROW : opts.updateRow,
    opts.updateError ?? null,
  );
  const deleteChain = makeDeleteChain(opts.deleteCount ?? 1, opts.deleteError ?? null);

  const from = vi.fn((_table: string) => ({
    ...updateChain,
    ...deleteChain,
  }));

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  return { client: { auth: { getUser }, from }, updateChain };
}

function makePatchRequest(body: unknown, memoId = MEMO_ID) {
  return new Request(`http://localhost/api/memos/${memoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
}

function makeDeleteRequest(memoId = MEMO_ID) {
  return new Request(`http://localhost/api/memos/${memoId}`, {
    method: 'DELETE',
  }) as unknown as Parameters<typeof DELETE>[0];
}

function makeParams(memoId = MEMO_ID) {
  return { params: Promise.resolve({ memoId }) };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

// ─── PATCH ──────────────────────────────────────────────────────────────────

describe('PATCH /api/memos/[memoId] — 입력 검증', () => {
  it('400 → non-JSON body', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new Request('http://localhost/api/memos/m1', {
      method: 'PATCH',
      body: 'bad',
    }) as unknown as Parameters<typeof PATCH>[0];

    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('400 → body 빈 문자열', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ body: '' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('400 → body 81자', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ body: 'a'.repeat(81) }), makeParams());
    expect(res.status).toBe(400);
  });

  it('400 → extra 필드 (strict)', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ body: '좋아요', extra: 'y' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('401 → 미인증', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ body: '수정' }), makeParams());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('PATCH /api/memos/[memoId] — 수정', () => {
  it('200 → 수정된 memo 반환 (user_id 미포함)', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ body: '수정된 메모' }), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.memo.body).toBe('수정된 메모');
    expect(body.memo).not.toHaveProperty('user_id');
  });

  it('LOCKED: relation_memos 만 변경, 점수 테이블 미접촉', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    await PATCH(makePatchRequest({ body: '수정' }), makeParams());

    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: string[]) => c[0]);
    // hapcard_score_snapshots 나 기타 점수 테이블에 절대 접근 안 함
    expect(fromCalls).not.toContain('hapcard_score_snapshots');
    expect(fromCalls).not.toContain('hapcards');
  });

  it('404 → 0건 업데이트 (본인 외 또는 미존재)', async () => {
    const { client } = makeClient({ updateRow: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ body: '수정' }), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('MEMO_NOT_FOUND');
  });

  it('500 → update 오류', async () => {
    const { client } = makeClient({ updateError: { message: 'db error' } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await PATCH(makePatchRequest({ body: '수정' }), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────────────

describe('DELETE /api/memos/[memoId]', () => {
  it('401 → 미인증', async () => {
    const { client } = makeClient({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('200 → 삭제 성공', async () => {
    const { client } = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('200 → 멱등 (0건 삭제여도 200)', async () => {
    const { client } = makeClient({ deleteCount: 0 });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
  });

  it('500 → delete 오류', async () => {
    const { client } = makeClient({ deleteError: { message: 'db error' } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
