import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { POST } from '@/app/api/auth/sign-out/route';
import { createClient } from '@/lib/supabase/server';

function makeClient(signOutError: { message: string } | null = null) {
  const signOut = vi.fn().mockResolvedValue({ error: signOutError });
  return { auth: { signOut }, _signOut: signOut };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/sign-out', () => {
  it('Supabase 세션을 종료하고 ok=true를 반환한다', async () => {
    const client = makeClient();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(client._signOut).toHaveBeenCalled();
  });

  it('signOut 실패 시 기존 에러 응답 포맷으로 500을 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient({ message: 'auth down' }) as never);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe('SIGN_OUT_FAILED');
  });
});
