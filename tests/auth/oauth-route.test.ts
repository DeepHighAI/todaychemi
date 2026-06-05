import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/ssr');
vi.mock('next/headers');
vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicConfig: () => ({
    url: 'https://fake.supabase.co',
    anonKey: 'fake-anon-key',
  }),
}));

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { GET } from '@/app/auth/oauth/route';

const mockSignInWithOAuth = vi.fn();
const mockGetAll = vi.fn(() => []);
const mockSet = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue({
    getAll: mockGetAll,
    set: mockSet,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
  vi.mocked(createServerClient).mockReturnValue({
    auth: { signInWithOAuth: mockSignInWithOAuth },
  } as unknown as ReturnType<typeof createServerClient>);
});

function makeRequest(url: string) {
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

describe('GET /auth/oauth', () => {
  it('starts Google OAuth server-side and redirects to Supabase authorize URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://fake.supabase.co/auth/v1/authorize?provider=google' },
      error: null,
    });

    const res = await GET(
      makeRequest('https://app.example.com/auth/oauth?provider=google&next=%2Fprofile'),
    );

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.com/auth/callback?provider=google&next=%2Fprofile',
      },
    });
    expect(res.headers.get('location')).toBe(
      'https://fake.supabase.co/auth/v1/authorize?provider=google',
    );
  });

  it('starts Kakao OAuth through the same server-side route', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://fake.supabase.co/auth/v1/authorize?provider=kakao' },
      error: null,
    });

    const res = await GET(makeRequest('https://app.example.com/auth/oauth?provider=kakao'));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: {
        redirectTo: 'https://app.example.com/auth/callback?provider=kakao',
      },
    });
    expect(res.headers.get('location')).toBe(
      'https://fake.supabase.co/auth/v1/authorize?provider=kakao',
    );
  });

  it('wires Supabase server storage cookie writes to the route cookie store', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://fake.supabase.co/auth/v1/authorize?provider=google' },
      error: null,
    });

    await GET(makeRequest('https://app.example.com/auth/oauth?provider=google'));

    const options = vi.mocked(createServerClient).mock.calls[0]?.[2] as unknown as {
      cookies: {
        setAll: (
          toSet: Array<{ name: string; value: string; options: { path: string } }>,
          keyHints?: unknown,
        ) => void;
      };
    };

    options.cookies.setAll([
      { name: 'sb-fake-auth-token-code-verifier', value: 'verifier', options: { path: '/' } },
    ], {});

    expect(mockSet).toHaveBeenCalledWith(
      'sb-fake-auth-token-code-verifier',
      'verifier',
      { path: '/' },
    );
  });

  it('drops unsafe next URLs before building the callback URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://fake.supabase.co/auth/v1/authorize?provider=google' },
      error: null,
    });

    await GET(
      makeRequest(
        'https://app.example.com/auth/oauth?provider=google&next=https%3A%2F%2Fevil.example.com',
      ),
    );

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.com/auth/callback?provider=google',
      },
    });
  });

  it('redirects to the existing auth error UX for unsupported providers', async () => {
    const res = await GET(makeRequest('https://app.example.com/auth/oauth?provider=github'));

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=auth_callback_failed',
    );
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('redirects to the existing auth error UX when Supabase fails to build a provider URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: 'provider disabled' },
    });

    const res = await GET(makeRequest('https://app.example.com/auth/oauth?provider=google'));

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=auth_callback_failed',
    );
  });
});
