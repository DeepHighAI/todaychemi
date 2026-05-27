import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/ssr');
vi.mock('next/headers');
vi.mock('@/lib/legal/server-consent');
vi.mock('@/lib/auth/user-profile');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicConfig: () => ({
    url: 'https://fake.supabase.co',
    anonKey: 'fake-anon-key',
  }),
}));

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  claimLegalConsentFromCookie,
  clearLegalConsentCookie,
} from '@/lib/legal/server-consent';
import { hasPublicUserProfile } from '@/lib/auth/user-profile';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { GET } from '@/app/auth/callback/route';

const mockExchangeCodeForSession = vi.fn();
const mockGetAll = vi.fn(() => []);
const mockSet = vi.fn();
const serviceClient = { from: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue({
    getAll: mockGetAll,
    set: mockSet,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
  vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
  vi.mocked(hasPublicUserProfile).mockResolvedValue(false);
  vi.mocked(claimLegalConsentFromCookie).mockResolvedValue({
    termsVersion: '2026-06-01',
    privacyVersion: '2026-06-01',
    ageConfirmed: true,
    consentedAt: '2026-06-01T00:00:00.000Z',
  });
  vi.mocked(createServerClient).mockReturnValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  } as unknown as ReturnType<typeof createServerClient>);
});

function makeRequest(url: string) {
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

describe('GET /auth/callback', () => {
  it('redirects existing users to / without requiring legal consent', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null });
    vi.mocked(hasPublicUserProfile).mockResolvedValue(true);
    const req = makeRequest('https://app.example.com/auth/callback?code=abc123');

    const res = await GET(req);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toBe('https://app.example.com/');
    expect(claimLegalConsentFromCookie).not.toHaveBeenCalled();
    expect(clearLegalConsentCookie).not.toHaveBeenCalled();
  });

  it('claims existing consent and redirects new users when a legal cookie exists', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null });
    const req = makeRequest('https://app.example.com/auth/callback?code=abc123&provider=google');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe('https://app.example.com/');
    expect(claimLegalConsentFromCookie).toHaveBeenCalledWith(
      expect.objectContaining({ serviceClient, userId: 'user-001' }),
    );
    expect(clearLegalConsentCookie).toHaveBeenCalled();
  });

  it('uses custom next param when provided', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null });
    const req = makeRequest(
      'https://app.example.com/auth/callback?code=abc123&provider=google&next=%2Fprofile',
    );

    const res = await GET(req);

    expect(res.headers.get('location')).toBe('https://app.example.com/profile');
  });

  it('falls back to / when next param is an absolute external URL', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null });
    const req = makeRequest(
      'https://app.example.com/auth/callback?code=abc123&next=https%3A%2F%2Fevil.example.com',
    );

    const res = await GET(req);

    expect(res.headers.get('location')).toBe('https://app.example.com/');
  });

  it('redirects to /login?error when no code present', async () => {
    const req = makeRequest('https://app.example.com/auth/callback');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=auth_callback_failed',
    );
  });

  it('redirects to /login?error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: null, error: { message: 'invalid code' } });
    const req = makeRequest('https://app.example.com/auth/callback?code=bad');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=auth_callback_failed',
    );
  });

  it('redirects new users without a legal cookie to the social consent page', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null });
    vi.mocked(claimLegalConsentFromCookie).mockResolvedValue(null);
    const req = makeRequest('https://app.example.com/auth/callback?code=abc123&provider=google');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/auth/social-consent?provider=google&next=%2Fonboarding',
    );
    expect(clearLegalConsentCookie).not.toHaveBeenCalled();
  });

  it('redirects to legal_consent_failed when a new user is missing provider context', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null });
    vi.mocked(claimLegalConsentFromCookie).mockResolvedValue(null);
    const req = makeRequest('https://app.example.com/auth/callback?code=abc123');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=legal_consent_failed',
    );
  });

  it('redirects to auth failure when session exchange returns no user', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: null });
    const req = makeRequest('https://app.example.com/auth/callback?code=abc123');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=auth_callback_failed',
    );
    expect(claimLegalConsentFromCookie).not.toHaveBeenCalled();
  });

  it('redirects to legal_consent_failed when claim throws', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'user-001' } }, error: null });
    vi.mocked(claimLegalConsentFromCookie).mockRejectedValue(new Error('claim failed'));
    const req = makeRequest('https://app.example.com/auth/callback?code=abc123');

    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://app.example.com/login?error=legal_consent_failed',
    );
  });
});
