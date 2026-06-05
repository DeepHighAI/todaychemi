import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLocationAssign = vi.fn();
const ACCEPTED_LEGAL_CONSENT = { terms: true, privacy: true, age: true } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
  vi.stubGlobal('window', {
    location: {
      origin: 'https://test.example.com',
      assign: mockLocationAssign,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signInWithKakao', () => {
  it('records legal consent and redirects to the shared server OAuth starter', async () => {
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
    expect(mockLocationAssign).toHaveBeenCalledOnce();
    expect(mockLocationAssign).toHaveBeenCalledWith(
      'https://test.example.com/auth/oauth?provider=kakao',
    );
  });

  it('preserves a safe next path in the OAuth starter URL', async () => {
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await signInWithKakao(ACCEPTED_LEGAL_CONSENT, { next: '/guest/complete' });

    expect(mockLocationAssign).toHaveBeenCalledWith(
      'https://test.example.com/auth/oauth?provider=kakao&next=%2Fguest%2Fcomplete',
    );
  });

  it('can reuse an existing guest consent nonce without recording a new OAuth consent', async () => {
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await signInWithKakao(
      { terms: false, privacy: false, age: false },
      { next: '/guest/complete', reuseExistingConsent: true },
    );

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockLocationAssign).toHaveBeenCalledWith(
      'https://test.example.com/auth/oauth?provider=kakao&next=%2Fguest%2Fcomplete',
    );
  });

  it('can defer legal consent until after the OAuth callback', async () => {
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await signInWithKakao(
      { terms: false, privacy: false, age: false },
      { next: '/', deferLegalConsent: true },
    );

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockLocationAssign).toHaveBeenCalledWith(
      'https://test.example.com/auth/oauth?provider=kakao&next=%2F',
    );
  });

  it('throws before OAuth when legal consent is incomplete', async () => {
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await expect(
      signInWithKakao({ terms: true, privacy: false, age: true }),
    ).rejects.toThrow('LEGAL_CONSENT_REQUIRED');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockLocationAssign).not.toHaveBeenCalled();
  });

  it('throws before OAuth when legal consent recording fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 500 })),
    );
    const { signInWithKakao } = await import('@/lib/auth/kakao');

    await expect(signInWithKakao(ACCEPTED_LEGAL_CONSENT)).rejects.toThrow(
      'LEGAL_CONSENT_REQUIRED',
    );
    expect(mockLocationAssign).not.toHaveBeenCalled();
  });
});
