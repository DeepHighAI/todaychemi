import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/service-role');

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { POST } from '@/app/api/share/kakao/callback/route';

const SHARE_ID = '550e8400-e29b-41d4-a716-446655440001';
const ORIGINAL_ENV = { ...process.env };
const rpc = vi.fn();

function makeRequest(body: unknown, init: { auth?: string; resourceId?: string } = {}) {
  return new Request('https://hap.plae/api/share/kakao/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: init.auth ?? 'KakaoAK test-admin-key',
      'X-Kakao-Resource-ID': init.resourceId ?? 'resource-001',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KAKAO_ADMIN_KEY = 'test-admin-key';
  rpc.mockResolvedValue({ data: { awarded: true, reason: 'AWARDED' }, error: null });
  vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as never);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('POST /api/share/kakao/callback', () => {
  it('verifies Kakao admin key and awards with webhook resource id', async () => {
    const res = await POST(makeRequest({ share_id: SHARE_ID }));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('award_hapcard_share_reward', {
      p_share_id: SHARE_ID,
      p_channel: 'kakao',
      p_webhook_resource_id: 'resource-001',
    });
  });

  it('401 for wrong admin key', async () => {
    const res = await POST(makeRequest({ share_id: SHARE_ID }, { auth: 'KakaoAK wrong' }));

    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('400 when Kakao resource id is missing', async () => {
    const req = new Request('https://hap.plae/api/share/kakao/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'KakaoAK test-admin-key',
      },
      body: JSON.stringify({ share_id: SHARE_ID }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 200 for duplicate webhook idempotency result', async () => {
    rpc.mockResolvedValue({ data: { awarded: false, reason: 'DUPLICATE_WEBHOOK' }, error: null });

    const res = await POST(makeRequest({ share_id: SHARE_ID }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reward).toEqual({ awarded: false, reason: 'DUPLICATE_WEBHOOK' });
  });

  it('404 when share_id is not found', async () => {
    rpc.mockResolvedValue({ data: { awarded: false, reason: 'SHARE_NOT_FOUND' }, error: null });

    const res = await POST(makeRequest({ share_id: SHARE_ID }));

    expect(res.status).toBe(404);
  });

  it('outer catch 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(createServiceRoleClient).mockImplementation(() => {
      throw new Error('kakao callback failed birth_date=1991-03-15 birth_time=14:30 gender=F');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(makeRequest({ share_id: SHARE_ID }));

    expect(res.status).toBe(500);
    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1991-03-15');
    expect(calls).not.toContain('14:30');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });
});
