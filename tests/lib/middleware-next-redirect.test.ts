import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const getUserMock = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

describe('updateSession — ?next= 목적지 보존 (F-004)', () => {
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
      cookies: { getAll: () => [], set: vi.fn() },
    };
  }

  function getLocation(res: unknown): string {
    const headers = (res as { headers?: Headers }).headers;
    if (headers && typeof headers.get === 'function') {
      return headers.get('location') ?? '';
    }
    return '';
  }

  it('미인증: /me → /login?next=/me', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/me'));
    const loc = new URL(getLocation(res));
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('next')).toBe('/me');
  });

  it('미인증: /feed → /login?next=/feed', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/feed'));
    const loc = new URL(getLocation(res));
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('next')).toBe('/feed');
  });

  it('미인증: /hapcard/abc123 → /login?next=/hapcard/abc123', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('@/lib/supabase/middleware');
    // @ts-expect-error — partial mock
    const res = await updateSession(makeRequest('/hapcard/abc123'));
    const loc = new URL(getLocation(res));
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('next')).toBe('/hapcard/abc123');
  });
});
