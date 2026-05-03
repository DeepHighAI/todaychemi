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

  it('updateSession returns a response (auth cookies refresh path)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock satisfies interface
    const res = await updateSession(makeRequest('/'));
    expect(res).toBeDefined();
    expect(getUserMock).toHaveBeenCalled();
  });

  it('redirects to /login when no user and path starts with /app', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/app/hapcards'));
    // NextResponse.redirect 는 Location 헤더 보유 — 정확한 타입 확인 어려우니 status 또는 headers 체크
    expect(res).toBeDefined();
    // Next 16 NextResponse.redirect status: 307 or set headers.location
    const headers = (res as { headers?: Headers }).headers;
    if (headers && typeof headers.get === 'function') {
      const loc = headers.get('location');
      expect(loc).toMatch(/\/login/);
    }
  });

  it('does not redirect for non-/app paths when user is null', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/'));
    expect(res).toBeDefined();
    const headers = (res as { headers?: Headers }).headers;
    if (headers && typeof headers.get === 'function') {
      const loc = headers.get('location');
      expect(loc == null || !loc.includes('/login')).toBe(true);
    }
  });
});
