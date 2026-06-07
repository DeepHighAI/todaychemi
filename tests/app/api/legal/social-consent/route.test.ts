import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/user-profile');
vi.mock('@/lib/legal/server-consent');
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');

import { hasPublicUserProfile } from '@/lib/auth/user-profile';
import { createClaimedLegalConsentRecord } from '@/lib/legal/server-consent';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { POST } from '@/app/api/legal/social-consent/route';

const serviceClient = { from: vi.fn() };

function makeRequest(body: unknown, init: { origin?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.origin) headers.Origin = init.origin;
  return new Request('https://hap.plae/api/legal/social-consent', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-001' } } }) },
  } as never);
  vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
  vi.mocked(hasPublicUserProfile).mockResolvedValue(false);
  vi.mocked(createClaimedLegalConsentRecord).mockResolvedValue({
    termsVersion: '2026-06-01',
    privacyVersion: '2026-06-01',
    ageConfirmed: true,
    consentedAt: '2026-06-01T00:00:00.000Z',
  });
});

describe('POST /api/legal/social-consent', () => {
  it('claims OAuth legal consent for the authenticated new social user', async () => {
    const res = await POST(
      makeRequest(
        { terms: true, privacy: true, age: true, provider: 'google' },
        { origin: 'https://hap.plae' },
      ),
    );

    expect(res.status).toBe(200);
    expect(createClaimedLegalConsentRecord).toHaveBeenCalledWith({
      serviceClient,
      flow: 'oauth',
      provider: 'google',
      userId: 'user-001',
    });
    await expect(res.json()).resolves.toEqual({ ok: true, already_onboarded: false });
  });

  it('does not create a new consent record for an already onboarded user', async () => {
    vi.mocked(hasPublicUserProfile).mockResolvedValue(true);

    const res = await POST(makeRequest({ terms: true, privacy: true, age: true, provider: 'kakao' }));

    expect(res.status).toBe(200);
    expect(createClaimedLegalConsentRecord).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({ ok: true, already_onboarded: true });
  });

  it('401 when no authenticated user exists', async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);

    const res = await POST(makeRequest({ terms: true, privacy: true, age: true, provider: 'google' }));

    expect(res.status).toBe(401);
    expect(createClaimedLegalConsentRecord).not.toHaveBeenCalled();
  });

  it('400 when a required consent item is missing', async () => {
    const res = await POST(makeRequest({ terms: true, privacy: false, age: true, provider: 'google' }));

    expect(res.status).toBe(400);
    expect(createClaimedLegalConsentRecord).not.toHaveBeenCalled();
  });

  it('403 for cross-origin social consent posts', async () => {
    const res = await POST(
      makeRequest(
        { terms: true, privacy: true, age: true, provider: 'google' },
        { origin: 'https://evil.example' },
      ),
    );

    expect(res.status).toBe(403);
    expect(createClaimedLegalConsentRecord).not.toHaveBeenCalled();
  });

  it('outer catch 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(createServerClient).mockRejectedValue(
      new Error('social consent failed birth_date=1991-03-15 birth_time=14:30 gender=F'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(makeRequest({ terms: true, privacy: true, age: true, provider: 'google' }));

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
