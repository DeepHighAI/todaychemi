import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/share/complete/route';

const SHARE_ID = '550e8400-e29b-41d4-a716-446655440001';
const USER_ID = '550e8400-e29b-41d4-a716-446655440099';

function makeUserClient(opts: { userId?: string | null; share?: boolean } = {}) {
  const userId = opts.userId === undefined ? USER_ID : opts.userId;
  const share = opts.share ?? true;
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      expect(table).toBe('hapcard_shares');
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: share ? { share_id: SHARE_ID, user_id: USER_ID } : null,
                error: null,
              }),
            }),
          }),
        }),
      };
    }),
  };
}

function makeRequest(body: unknown) {
  return new Request('https://hap.plae/api/share/complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue(makeUserClient() as never);
});

describe('POST /api/share/complete', () => {
  it('does not award Instagram completion because it is not server-verifiable', async () => {
    const res = await POST(makeRequest({ share_id: SHARE_ID, channel: 'instagram' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reward).toEqual({ awarded: false, reason: 'UNVERIFIED_CHANNEL' });
  });

  it('does not award Kakao from client complete route because webhook is required', async () => {
    const res = await POST(makeRequest({ share_id: SHARE_ID, channel: 'kakao' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reward).toEqual({ awarded: false, reason: 'WEBHOOK_REQUIRED' });
  });

  it('401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(makeUserClient({ userId: null }) as never);

    const res = await POST(makeRequest({ share_id: SHARE_ID, channel: 'instagram' }));

    expect(res.status).toBe(401);
  });

  it('404 when share does not belong to user', async () => {
    vi.mocked(createClient).mockResolvedValue(makeUserClient({ share: false }) as never);

    const res = await POST(makeRequest({ share_id: SHARE_ID, channel: 'instagram' }));

    expect(res.status).toBe(404);
  });

  it('copy_link returns no reward and does not block the share UX', async () => {
    const res = await POST(makeRequest({ share_id: SHARE_ID, channel: 'copy_link' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reward).toEqual({ awarded: false, reason: 'UNVERIFIED_CHANNEL' });
  });
});
