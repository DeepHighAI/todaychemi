import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client');

import { createClient } from '@/lib/supabase/client';

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const ACCEPTED_LEGAL_CONSENT = { terms: true, privacy: true, age: true } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
  vi.mocked(createClient).mockReturnValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
    },
  } as unknown as ReturnType<typeof createClient>);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signInWithEmail', () => {
  it('calls signInWithPassword with email and password', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const { signInWithEmail } = await import('@/lib/auth/email');

    await signInWithEmail('user@example.com', 'test1234');

    expect(mockSignInWithPassword).toHaveBeenCalledOnce();
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'test1234',
    });
  });

  it('throws when supabase returns an error', async () => {
    const fakeError = { message: 'invalid credentials' };
    mockSignInWithPassword.mockResolvedValue({ error: fakeError });
    const { signInWithEmail } = await import('@/lib/auth/email');

    await expect(signInWithEmail('user@example.com', 'test1234')).rejects.toEqual(fakeError);
  });
});

describe('signUpWithEmail', () => {
  it('throws WeakPasswordError with tooShort when password is under 8 chars', async () => {
    const { signUpWithEmail, WeakPasswordError } = await import('@/lib/auth/email');

    await expect(
      signUpWithEmail('user@example.com', 'test', ACCEPTED_LEGAL_CONSENT),
    ).rejects.toBeInstanceOf(
      WeakPasswordError,
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('throws WeakPasswordError with missingClasses for letters-only password', async () => {
    const { signUpWithEmail, WeakPasswordError } = await import('@/lib/auth/email');
    const error = await signUpWithEmail(
      'user@example.com',
      'abcdefgh',
      ACCEPTED_LEGAL_CONSENT,
    ).catch((e) => e);

    expect(error).toBeInstanceOf(WeakPasswordError);
    expect(error.code).toBe('missingClasses');
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('records server-side legal consent before valid email signup', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const { signUpWithEmail } = await import('@/lib/auth/email');

    await signUpWithEmail('user@example.com', 'test1234', ACCEPTED_LEGAL_CONSENT);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/legal/consent',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ ...ACCEPTED_LEGAL_CONSENT, flow: 'email', provider: undefined }),
      }),
    );
    expect(mockSignUp).toHaveBeenCalledOnce();
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'test1234',
    });
  });

  it('can reuse an existing guest consent nonce before valid email signup', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const { signUpWithEmail } = await import('@/lib/auth/email');

    await signUpWithEmail('user@example.com', 'test1234', {
      terms: false,
      privacy: false,
      age: false,
    }, { reuseExistingConsent: true });

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'test1234',
    });
  });

  it('throws before calling Supabase when legal consent is incomplete', async () => {
    const { signUpWithEmail } = await import('@/lib/auth/email');

    await expect(
      signUpWithEmail('user@example.com', 'test1234', {
        terms: true,
        privacy: false,
        age: true,
      }),
    ).rejects.toThrow('LEGAL_CONSENT_REQUIRED');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('throws when supabase signUp returns an error', async () => {
    const fakeError = { message: 'email already in use', status: 422 };
    mockSignUp.mockResolvedValue({ error: fakeError });
    const { signUpWithEmail } = await import('@/lib/auth/email');

    await expect(
      signUpWithEmail('user@example.com', 'test1234', ACCEPTED_LEGAL_CONSENT),
    ).rejects.toEqual(fakeError);
  });

  it('resolves without a value on successful signup', async () => {
    mockSignUp.mockResolvedValue({ error: null, data: { user: { id: 'abc' } } });
    const { signUpWithEmail } = await import('@/lib/auth/email');

    const result = await signUpWithEmail(
      'new@example.com',
      'newuser1234',
      ACCEPTED_LEGAL_CONSENT,
    );

    expect(result).toBeUndefined();
  });
});
