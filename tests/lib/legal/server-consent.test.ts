import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LEGAL_CONSENT_COOKIE,
  buildLegalConsentCookieOptions,
  clearLegalConsentCookie,
  createLegalConsentRecord,
  createSignedGuestLegalConsentToken,
  hashLegalConsentToken,
  resolveGuestLegalConsentFromCookie,
  setLegalConsentCookie,
} from '@/lib/legal/server-consent';

function makeInsertService(capture: { row?: Record<string, unknown> }) {
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server legal consent helpers', () => {
  it('hashes nonce tokens before persistence', () => {
    const token = 'raw-token-value';
    const hash = hashLegalConsentToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
  });

  it('creates a consent record with token_hash and never inserts the raw token', async () => {
    const capture: { row?: Record<string, unknown> } = {};
    const result = await createLegalConsentRecord({
      serviceClient: makeInsertService(capture) as never,
      flow: 'oauth',
      provider: 'google',
      now: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(result.token).toBeTruthy();
    expect(capture.row?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(capture.row?.token_hash).not.toBe(result.token);
    expect(capture.row).not.toHaveProperty('token');
    expect(result.consent).toEqual({
      termsVersion: '2026-06-01',
      privacyVersion: '2026-06-01',
      ageConfirmed: true,
      consentedAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('uses HttpOnly SameSite=Lax cookie options', () => {
    expect(buildLegalConsentCookieOptions()).toEqual(
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  it('sets and clears the legal consent cookie without exposing DB state', () => {
    const set = vi.fn();
    const cookieStore = { get: vi.fn(), set };

    setLegalConsentCookie(cookieStore, 'raw-token');
    clearLegalConsentCookie(cookieStore);

    expect(set).toHaveBeenNthCalledWith(
      1,
      LEGAL_CONSENT_COOKIE,
      'raw-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(set).toHaveBeenNthCalledWith(
      2,
      LEGAL_CONSENT_COOKIE,
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it('creates and resolves signed guest consent tokens without a database lookup', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-signing-secret');
    const now = new Date('2026-06-01T00:00:00.000Z');
    const { token, consent } = createSignedGuestLegalConsentToken({ now, ttlSeconds: 60 });
    const serviceClient = { from: vi.fn() };

    const resolved = await resolveGuestLegalConsentFromCookie({
      serviceClient: serviceClient as never,
      cookieStore: { get: vi.fn().mockReturnValue({ value: token }), set: vi.fn() },
      now: new Date('2026-06-01T00:00:30.000Z'),
    });

    expect(token).toMatch(/^guest\.v1\./);
    expect(resolved).toEqual(consent);
    expect(serviceClient.from).not.toHaveBeenCalled();
  });

  it('rejects expired signed guest consent tokens', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-signing-secret');
    const { token } = createSignedGuestLegalConsentToken({
      now: new Date('2026-06-01T00:00:00.000Z'),
      ttlSeconds: 60,
    });

    const resolved = await resolveGuestLegalConsentFromCookie({
      serviceClient: { from: vi.fn() } as never,
      cookieStore: { get: vi.fn().mockReturnValue({ value: token }), set: vi.fn() },
      now: new Date('2026-06-01T00:01:01.000Z'),
    });

    expect(resolved).toBeNull();
  });
});
