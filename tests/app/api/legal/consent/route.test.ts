import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers');
vi.mock('@/lib/supabase/service-role');

import { cookies } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { POST } from '@/app/api/legal/consent/route';

const cookieSet = vi.fn();

function makeService(capture: { row?: Record<string, unknown> }) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      expect(table).toBe('legal_consents');
      return {
        insert: (row: Record<string, unknown>) => {
          capture.row = row;
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    consent_id: '550e8400-e29b-41d4-a716-446655440001',
                    auth_user_id: null,
                    claimed_at: null,
                    ...row,
                  },
                  error: null,
                }),
            }),
          };
        },
      };
    }),
  };
}

function makeRequest(body: unknown, init: { origin?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.origin) headers.Origin = init.origin;
  return new Request('https://hap.plae/api/legal/consent', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue({ set: cookieSet } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/legal/consent', () => {
  it('records complete email consent and issues an HttpOnly nonce cookie', async () => {
    const capture: { row?: Record<string, unknown> } = {};
    vi.mocked(createServiceRoleClient).mockReturnValue(makeService(capture) as never);

    const res = await POST(
      makeRequest(
        { terms: true, privacy: true, age: true, flow: 'email' },
        { origin: 'https://hap.plae' },
      ),
    );

    expect(res.status).toBe(200);
    expect(capture.row?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(capture.row).not.toHaveProperty('token');
    expect(capture.row).toEqual(
      expect.objectContaining({
        flow: 'email',
        provider: null,
        terms_version: '2026-06-01',
        privacy_version: '2026-06-01',
        age_confirmed: true,
      }),
    );

    expect(cookieSet).toHaveBeenCalledWith(
      'osa_legal_consent',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(cookieSet.mock.calls[0][1]).not.toBe(capture.row?.token_hash);
  });

  it('records OAuth consent only when provider is present', async () => {
    const capture: { row?: Record<string, unknown> } = {};
    vi.mocked(createServiceRoleClient).mockReturnValue(makeService(capture) as never);

    const res = await POST(
      makeRequest({ terms: true, privacy: true, age: true, flow: 'oauth', provider: 'kakao' }),
    );

    expect(res.status).toBe(200);
    expect(capture.row).toEqual(expect.objectContaining({ flow: 'oauth', provider: 'kakao' }));
  });

  it('records guest consent with a longer HttpOnly nonce cookie', async () => {
    const capture: { row?: Record<string, unknown> } = {};
    vi.mocked(createServiceRoleClient).mockReturnValue(makeService(capture) as never);

    const res = await POST(
      makeRequest({ terms: true, privacy: true, age: true, flow: 'guest' }),
    );

    expect(res.status).toBe(200);
    expect(capture.row).toEqual(expect.objectContaining({ flow: 'guest', provider: null }));
    expect(cookieSet).toHaveBeenCalledWith(
      'osa_legal_consent',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
      }),
    );
  });

  it('falls back to a signed guest consent cookie in non-production when DB recording fails', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-signing-secret');
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'fetch failed' } }),
          }),
        }),
      })),
    } as never);

    const res = await POST(
      makeRequest({ terms: true, privacy: true, age: true, flow: 'guest' }),
    );

    expect(res.status).toBe(200);
    expect(cookieSet).toHaveBeenCalledWith(
      'osa_legal_consent',
      expect.stringMatching(/^guest\.v1\./),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
      }),
    );
  });

  it('400 when a required consent item is missing', async () => {
    const capture: { row?: Record<string, unknown> } = {};
    vi.mocked(createServiceRoleClient).mockReturnValue(makeService(capture) as never);

    const res = await POST(makeRequest({ terms: true, privacy: false, age: true, flow: 'email' }));

    expect(res.status).toBe(400);
    expect(capture.row).toBeUndefined();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('400 when OAuth provider is missing or email/guest flow includes one', async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(makeService({}) as never);

    const missingProvider = await POST(
      makeRequest({ terms: true, privacy: true, age: true, flow: 'oauth' }),
    );
    const unexpectedProvider = await POST(
      makeRequest({ terms: true, privacy: true, age: true, flow: 'email', provider: 'google' }),
    );
    const unexpectedGuestProvider = await POST(
      makeRequest({ terms: true, privacy: true, age: true, flow: 'guest', provider: 'google' }),
    );

    expect(missingProvider.status).toBe(400);
    expect(unexpectedProvider.status).toBe(400);
    expect(unexpectedGuestProvider.status).toBe(400);
  });

  it('403 for cross-origin consent posts', async () => {
    const capture: { row?: Record<string, unknown> } = {};
    vi.mocked(createServiceRoleClient).mockReturnValue(makeService(capture) as never);

    const res = await POST(
      makeRequest(
        { terms: true, privacy: true, age: true, flow: 'email' },
        { origin: 'https://evil.example' },
      ),
    );

    expect(res.status).toBe(403);
    expect(capture.row).toBeUndefined();
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
