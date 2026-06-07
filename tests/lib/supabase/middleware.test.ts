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

  function makeRequest(pathname: string, cookies: Array<{ name: string; value: string }> = []) {
    const url = new URL(`http://localhost${pathname}`);
    return {
      nextUrl: url,
      url: url.toString(),
      cookies: {
        getAll: () => cookies,
        set: vi.fn(),
      },
    };
  }

  function makeAuthedRequest(pathname: string) {
    return makeRequest(pathname, [{ name: 'sb-test-auth-token', value: 'token' }]);
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

  it('미인증: / → /start 리다이렉트 (신규/기존 분기)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/'));
    expect(getLocation(res)).toMatch(/\/start/);
    expect(getUserMock).not.toHaveBeenCalled();
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

  it('미인증: /start → 리다이렉트 없음 (신규/기존 분기 공개)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/start'));
    expect(getLocation(res)).not.toMatch(/\/login/);
  });

  it('인증됨: /start → / 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeAuthedRequest('/start'));
    expect(getLocation(res)).toBe('http://localhost/');
  });

  it('인증됨: /login?next=/feed → next 보호 경로로 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeAuthedRequest('/login?next=/feed'));
    expect(getLocation(res)).toBe('http://localhost/feed');
  });

  it('인증됨: /login 의 unsafe next 는 홈으로 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeAuthedRequest('/login?next=https://evil.example.com'));
    expect(getLocation(res)).toBe('http://localhost/');
  });

  it('인증됨: /login?next=/login 은 자기 자신으로 루프하지 않고 홈으로 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeAuthedRequest('/login?next=/login'));
    expect(getLocation(res)).toBe('http://localhost/');
  });

  it('인증됨: /signup → / 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeAuthedRequest('/signup'));
    expect(getLocation(res)).toBe('http://localhost/');
  });

  it('인증됨: /signup?intent=guest → 게스트 이어받기 경로로 리다이렉트', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeAuthedRequest('/signup?intent=guest'));
    expect(getLocation(res)).toBe('http://localhost/guest/complete');
  });

  it('미인증: /onboarding/dob, /today/me, /guest/complete 공개 경로 통과', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');

    for (const path of ['/onboarding/dob', '/today/me', '/guest/complete']) {
      // @ts-expect-error — partial mock
      const res = await updateSession(makeRequest(path));
      expect(getLocation(res), path).not.toMatch(/\/login/);
    }
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

  it('미인증: /h/share-token → 리다이렉트 없음 (공개 공유 링크)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/h/share-token'));
    expect(getLocation(res)).not.toMatch(/\/login/);
  });

  // ── 인증 경로 (리다이렉트 없음) ──

  it('인증됨: / → 리다이렉트 없음 (Today 합류 화면 통과)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeAuthedRequest('/'));
    expect(res).toBeDefined();
    expect(getLocation(res)).not.toMatch(/\/login/);
  });
});

describe('middleware config', () => {
  it('루트 / 요청도 실제 matcher에 포함한다', async () => {
    const { config } = await import('../../../middleware');

    expect(config.matcher).toContain('/');
  });
});
