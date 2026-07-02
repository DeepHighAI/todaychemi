import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { GET } from '@/app/api/me/account-id/route';
import { createClient } from '@/lib/supabase/server';

const USER_ID = '11111111-2222-3333-4444-555555555555';

function makeClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/me/account-id', () => {
  it('returns the authenticated user id only', async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient() as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, userId: USER_ID });
    expect(JSON.stringify(body)).not.toContain('birth_date');
    expect(JSON.stringify(body)).not.toContain('birth_time');
  });

  it('401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient(null) as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
