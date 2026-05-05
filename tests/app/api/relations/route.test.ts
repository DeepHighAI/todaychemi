import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/relations/route';

const VALID_BODY = {
  nickname: '봄달',
  mode: '친구합',
  gender: 'F',
  birth_date: '1995-07-20',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '09:00',
  birth_longitude: null,
  consent_confirmed: true,
  is_primary: false,
};

function makeClient(opts: {
  userId?: string | null;
  insertError?: { code: string; message: string } | null;
}) {
  const userId = opts.userId === undefined ? 'user-uuid-001' : opts.userId;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  const insert = vi.fn().mockResolvedValue({
    data: null,
    error: opts.insertError ?? null,
  });

  const from = vi.fn().mockReturnValue({ insert });

  return { auth: { getUser }, from, _insert: insert };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/relations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/relations', () => {
  it('200 → relations INSERT 성공 (정상 경로)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(client._insert).toHaveBeenCalledOnce();
  });

  it('INSERT body 에 user_id, nickname, mode, birth_date, gender, consent_confirmed 전달됨', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    await POST(makeRequest(VALID_BODY));

    const inserted = client._insert.mock.calls[0][0];
    expect(inserted.user_id).toBe('user-uuid-001');
    expect(inserted.nickname).toBe('봄달');
    expect(inserted.mode).toBe('친구합');
    expect(inserted.birth_date).toBe('1995-07-20');
    expect(inserted.gender).toBe('F');
    expect(inserted.birth_time_knowledge).toBe('exact');
    expect(inserted.consent_confirmed).toBe(true);
  });

  it('400 → INVALID_BODY (nickname 없음)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const bad = structuredClone(VALID_BODY);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (bad as any).nickname;
    const res = await POST(makeRequest(bad));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_BODY');
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY (mode 외래값)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({ ...VALID_BODY, mode: '사랑합' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_BODY');
  });

  it('400 → INVALID_BODY (birth_place 추가 필드 — PII strict 가드)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({ ...VALID_BODY, birth_place: '서울' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_BODY');
  });

  it('401 → UNAUTHORIZED (미인증)', async () => {
    const client = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('500 → INTERNAL_ERROR (generic DB failure)', async () => {
    const client = makeClient({ insertError: { code: 'PGRST000', message: 'DB down' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('400 → INVALID_BODY on non-JSON body', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(
      new Request('http://localhost/api/relations', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not json',
      }) as unknown as Parameters<typeof POST>[0],
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_BODY');
  });
});
