import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client');

import { createClient } from '@/lib/supabase/client';

const mockSignInWithOAuth = vi.fn();
const ACCEPTED_LEGAL_CONSENT = { terms: true, privacy: true, age: true } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
  vi.mocked(createClient).mockReturnValue({
    auth: { signInWithOAuth: mockSignInWithOAuth },
  } as unknown as ReturnType<typeof createClient>);
  vi.stubGlobal('window', { location: { origin: 'https://test.example.com' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signInWithKakao', () => {
  it('calls signInWithOAuth with kakao provider and shared auth callback', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await signInWithKakao(ACCEPTED_LEGAL_CONSENT);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/legal/consent',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ ...ACCEPTED_LEGAL_CONSENT, flow: 'oauth', provider: 'kakao' }),
      }),
    );
    expect(mockSignInWithOAuth).toHaveBeenCalledOnce();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: {
        redirectTo: 'https://test.example.com/auth/callback?provider=kakao',
      },
    });
  });

  it('preserves a safe next path in the OAuth callback URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await signInWithKakao(ACCEPTED_LEGAL_CONSENT, { next: '/guest/complete' });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: {
        redirectTo: 'https://test.example.com/auth/callback?provider=kakao&next=%2Fguest%2Fcomplete',
      },
    });
  });

  it('can reuse an existing guest consent nonce without recording a new OAuth consent', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await signInWithKakao(
      { terms: false, privacy: false, age: false },
      { next: '/guest/complete', reuseExistingConsent: true },
    );

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: {
        redirectTo: 'https://test.example.com/auth/callback?provider=kakao&next=%2Fguest%2Fcomplete',
      },
    });
  });

  it('can defer legal consent until after the OAuth callback', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await signInWithKakao(
      { terms: false, privacy: false, age: false },
      { next: '/', deferLegalConsent: true },
    );

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: {
        redirectTo: 'https://test.example.com/auth/callback?provider=kakao&next=%2F',
      },
    });
  });

  it('throws before OAuth when legal consent is incomplete', async () => {
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await expect(
      signInWithKakao({ terms: true, privacy: false, age: true }),
    ).rejects.toThrow('LEGAL_CONSENT_REQUIRED');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it('throws when signInWithOAuth returns an error', async () => {
    const fakeError = { message: 'provider disabled' };
    mockSignInWithOAuth.mockResolvedValue({ error: fakeError });
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await expect(signInWithKakao(ACCEPTED_LEGAL_CONSENT)).rejects.toEqual(fakeError);
  });
});
