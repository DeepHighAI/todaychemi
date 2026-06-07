import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { GET, runtime } from '@/app/api/og/hapcard/[id]/route';

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
                data: { nickname: '봄달', gender: 'F' },
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
  // Satori 폰트 fetch stub — 실제 네트워크 없이 ArrayBuffer 반환
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string | URL) => {
      if (url.toString().includes('/fonts/')) {
        return Promise.resolve(new Response(new ArrayBuffer(8)));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it('200 — ImageResponse 호출 시 PII 페이로드 미전달 (nickname/score/케미온도/mode/range만)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    const req = makeRequest(`https://hap.plae/api/og/hapcard/${HAPCARD_ID}?range=nickname-only`);
    await GET(req, { params: Promise.resolve({ id: HAPCARD_ID }) });
    expect(imageResponseSpy).toHaveBeenCalledOnce();
  });

  it('200 — ImageResponse에 Noto Sans KR fonts 옵션 전달됨', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient() as never);
    const req = makeRequest(`https://hap.plae/api/og/hapcard/${HAPCARD_ID}?range=nickname-only`);
    await GET(req, { params: Promise.resolve({ id: HAPCARD_ID }) });
    const opts = imageResponseSpy.mock.calls[0][1] as { fonts?: { name: string }[] };
    expect(opts?.fonts).toHaveLength(1);
    expect(opts?.fonts?.[0]?.name).toBe('Noto Sans KR');
  });

  it('runtime = "edge" export', () => {
    expect(runtime).toBe('edge');
  });

  it('render catch 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(createServerClient).mockRejectedValue(
      new Error('og failed birth_date=1991-03-15 birth_time=14:30 gender=F'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const req = makeRequest(`https://hap.plae/api/og/hapcard/${HAPCARD_ID}?range=nickname-only`);

    const res = await GET(req, { params: Promise.resolve({ id: HAPCARD_ID }) });

    expect(res.status).toBe(500);
    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1991-03-15');
    expect(calls).not.toContain('14:30');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });
});
