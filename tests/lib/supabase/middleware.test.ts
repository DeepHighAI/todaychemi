import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

// Mock @supabase/ssr to avoid real auth network call
const getUserMock = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

describe('updateSession middleware helper', () => {
  beforeEach(() => {
    vi.resetModules();
    getUserMock.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function makeRequest(pathname: string) {
    const url = new URL(`http://localhost${pathname}`);
    return {
      nextUrl: url,
      url: url.toString(),
      cookies: {
        getAll: () => [] as Array<{ name: string; value: string }>,
        set: vi.fn(),
      },
    };
  }

  // '' 반환으로 null-safe toMatch 보장
  function getLocation(res: unknown): string {
    const headers = (res as { headers?: Headers }).headers;
    if (headers && typeof headers.get === 'function') {
      return headers.get('location') ?? '';
    }
    return '';
  }

  // ── 보호 경로 (미인증 → /login 리다이렉트) ──

  it('미인증: / → /login 리다이렉트 (Today 홈 보호)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/'));
    expect(getLocation(res)).toMatch(/\/login/);
  });

  it('미인증: /me → /login 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/me'));
    expect(getLocation(res)).toMatch(/\/login/);
  });

  it('미인증: /feed → /login 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/feed'));
    expect(getLocation(res)).toMatch(/\/login/);
  });

  it('미인증: /relations/new → /login 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/relations/new'));
    expect(getLocation(res)).toMatch(/\/login/);
  });

  // ── 공개 경로 (미인증 통과) ──

  it('미인증: /login → 리다이렉트 없음 (무한 루프 방지)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/login'));
    expect(getLocation(res)).not.toMatch(/\/login/);
  });

  it('미인증: /auth/callback?code=X → 리다이렉트 없음 (OAuth 콜백 통과)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/auth/callback?code=abc123'));
    expect(getLocation(res)).not.toMatch(/\/login/);
  });

  it('미인증: /api/today → 리다이렉트 없음 (API 자체 인증 처리)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/api/today'));
    expect(getLocation(res)).not.toMatch(/\/login/);
  });

  // ── 인증 경로 (리다이렉트 없음) ──

  it('인증됨: / → 리다이렉트 없음 (Today 합류 화면 통과)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/'));
    expect(res).toBeDefined();
    expect(getLocation(res)).not.toMatch(/\/login/);
  });
});
