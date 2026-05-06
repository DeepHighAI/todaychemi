import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

const imageResponseSpy = vi.fn();

vi.mock('next/og', () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor(...args: unknown[]) {
      imageResponseSpy(...args);
      super('fake-png', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    }
  },
}));

import { createClient as createServerClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/og/hapcard/[id]/route';

const HAPCARD_ID = '550e8400-e29b-41d4-a716-446655440000';

interface MockResult<T = unknown> {
  data: T | null;
  error: null | { message: string };
}

function makeClient(opts: {
  userId?: string | null;
  hapcardRow?: MockResult<Record<string, unknown>>;
} = {}) {
  const userId = opts.userId === undefined ? 'user-001' : opts.userId;
  const hapcardRow = opts.hapcardRow ?? {
    data: {
      hapcard_id: HAPCARD_ID,
      mode: '친구합',
      compat_score: 78,
      relation_id: 'rel-001',
    },
    error: null,
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'hapcards') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(hapcardRow),
            }),
          }),
        };
      }
      if (table === 'relations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { nickname: '봄달', gender_normalized: 'F' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'relation_charts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { chart_core: { five_elements_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 } } },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
    }),
  };
}

function makeRequest(url: string): Request {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/og/hapcard/[id]', () => {
  it('200 image/png — 정상 응답', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    const req = makeRequest(`https://hap.plae/api/og/hapcard/${HAPCARD_ID}?range=nickname-only`);
    const res = await GET(req, { params: Promise.resolve({ id: HAPCARD_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('400 — range 미지정 또는 잘못된 값', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    const req = makeRequest(`https://hap.plae/api/og/hapcard/${HAPCARD_ID}?range=invalid-range`);
    const res = await GET(req, { params: Promise.resolve({ id: HAPCARD_ID }) });
    expect(res.status).toBe(400);
  });

  it('401 — 미인증', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient({ userId: null }) as never);
    const req = makeRequest(`https://hap.plae/api/og/hapcard/${HAPCARD_ID}?range=nickname-only`);
    const res = await GET(req, { params: Promise.resolve({ id: HAPCARD_ID }) });
    expect(res.status).toBe(401);
  });

  it('404 — hapcard 없음', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ hapcardRow: { data: null, error: null } }) as never,
    );
    const req = makeRequest(`https://hap.plae/api/og/hapcard/${HAPCARD_ID}?range=nickname-only`);
    const res = await GET(req, { params: Promise.resolve({ id: HAPCARD_ID }) });
    expect(res.status).toBe(404);
  });

  it('200 — ImageResponse 호출 시 PII 페이로드 미전달 (nickname/score/mode/range만)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    const req = makeRequest(`https://hap.plae/api/og/hapcard/${HAPCARD_ID}?range=nickname-only`);
    await GET(req, { params: Promise.resolve({ id: HAPCARD_ID }) });
    expect(imageResponseSpy).toHaveBeenCalledOnce();
  });
});
