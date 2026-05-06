import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

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
import { GET } from '@/app/auth/callback/route';

const mockExchangeCodeForSession = vi.fn();
const mockGetAll = vi.fn(() => []);
const mockSet = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue({
    getAll: mockGetAll,
    set: mockSet,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
  vi.mocked(createServerClient).mockReturnValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  } as unknown as ReturnType<typeof createServerClient>);
});

function makeRequest(url: string) {
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

describe('GET /auth/callback', () => {
  it('redirects to / when code exchange succeeds', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const req = makeRequest('https://app.example.com/auth/callback?code=abc123');

    const res = await GET(req);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toBe('https://app.example.com/');
  });

  it('uses custom next param when provided', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const req = makeRequest(
      'https://app.example.com/auth/callback?code=abc123&next=%2Fprofile',
    );

    const res = await GET(req);

    expect(res.headers.get('location')).toBe('https://app.example.com/profile');
  });

  it('redirects to /login?error when no code present', async () => {
    const req = makeRequest('https://app.example.com/auth/callback');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=auth_callback_failed',
    );
  });

  it('redirects to /login?error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid code' } });
    const req = makeRequest('https://app.example.com/auth/callback?code=bad');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=auth_callback_failed',
    );
  });
});
