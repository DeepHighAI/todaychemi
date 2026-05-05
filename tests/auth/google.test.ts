import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client');

import { createClient } from '@/lib/supabase/client';

const mockSignInWithOAuth = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockReturnValue({
    auth: { signInWithOAuth: mockSignInWithOAuth },
  } as unknown as ReturnType<typeof createClient>);
  vi.stubGlobal('window', { location: { origin: 'https://test.example.com' } });
});

describe('signInWithGoogle', () => {
  it('calls signInWithOAuth with google provider and correct redirectTo', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const { signInWithGoogle } = await import('@/lib/auth/google');

    await signInWithGoogle();

    expect(mockSignInWithOAuth).toHaveBeenCalledOnce();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://test.example.com/auth/callback',
      },
    });
  });

  it('throws when signInWithOAuth returns an error', async () => {
    const fakeError = { message: 'provider disabled' };
    mockSignInWithOAuth.mockResolvedValue({ error: fakeError });
    const { signInWithGoogle } = await import('@/lib/auth/google');

    await expect(signInWithGoogle()).rejects.toEqual(fakeError);
  });
});
