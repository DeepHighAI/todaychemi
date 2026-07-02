import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');

import { POST } from '@/app/api/toss/device/route';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { hashTossDeviceId } from '@/lib/toss/device';

const USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const ORIGINAL_ENV = { ...process.env };
const upsert = vi.fn();

function makeRequest(body: unknown) {
  return new Request('https://todaychemi.vercel.app/api/toss/device', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function makeUserClient(user: { id: string } | null = { id: USER_ID }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TOSS_DEVICE_ID_HASH_SECRET = 'device-hash-secret-for-tests';
  upsert.mockResolvedValue({ error: null });
  vi.mocked(createClient).mockResolvedValue(makeUserClient() as never);
  vi.mocked(createServiceRoleClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== 'toss_device_connections') throw new Error(`unexpected table ${table}`);
      return { upsert };
    }),
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('POST /api/toss/device', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(makeUserClient(null) as never);

    const res = await POST(makeRequest({ deviceId: 'raw-device-id' }));

    expect(res.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('stores only a HMAC hash for the authenticated user', async () => {
    const res = await POST(makeRequest({ deviceId: 'raw-device-id' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, registered: true });
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: USER_ID,
        device_id_hash: hashTossDeviceId('raw-device-id', 'device-hash-secret-for-tests'),
        last_seen_at: expect.any(String),
      },
      { onConflict: 'user_id,device_id_hash' },
    );
    expect(JSON.stringify(upsert.mock.calls)).not.toContain('raw-device-id');
  });

  it('rejects missing deviceId without touching service-role storage', async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns 500 on storage failure without logging raw device id', async () => {
    upsert.mockResolvedValue({ error: { message: 'db failed' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(makeRequest({ deviceId: 'raw-device-id' }));

    expect(res.status).toBe(500);
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain('raw-device-id');
  });
});
