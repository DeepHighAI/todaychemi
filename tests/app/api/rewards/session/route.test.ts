import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');

import { POST } from '@/app/api/rewards/session/route';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const AUTH_CREATED_AT = '2026-05-25T00:30:00.000Z';
const rpc = vi.fn();

function makeUserClient(user: { id: string; created_at?: string } | null = {
  id: USER_ID,
  created_at: AUTH_CREATED_AT,
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({
    data: {
      awarded: true,
      reason: 'AWARDED',
      signup_awarded: true,
      daily_login_awarded: true,
      amount_awarded: 6,
      balance_after: 6,
    },
    error: null,
  });
  vi.mocked(createClient).mockResolvedValue(makeUserClient() as never);
  vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as never);
});

describe('POST /api/rewards/session', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(makeUserClient(null) as never);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls session reward RPC with auth creation date and policy effective date', async () => {
    const res = await POST();

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('award_free_talisman_session_rewards', {
      uid: USER_ID,
      p_auth_created_at: AUTH_CREATED_AT,
      p_policy_effective_at: '2026-05-25T00:00:00+09:00',
    });
    const body = await res.json();
    expect(body.reward).toEqual(expect.objectContaining({ amount_awarded: 6 }));
  });

  it('returns profile-required as a non-fatal idempotent reward result', async () => {
    rpc.mockResolvedValue({
      data: {
        awarded: false,
        reason: 'PROFILE_REQUIRED',
        signup_awarded: false,
        daily_login_awarded: false,
        amount_awarded: 0,
        balance_after: null,
      },
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reward.reason).toBe('PROFILE_REQUIRED');
  });

  it('returns already-awarded as a successful idempotent result', async () => {
    rpc.mockResolvedValue({
      data: {
        awarded: false,
        reason: 'ALREADY_AWARDED',
        signup_awarded: false,
        daily_login_awarded: false,
        amount_awarded: 0,
        balance_after: 12,
      },
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reward.reason).toBe('ALREADY_AWARDED');
  });

  it('outer catch 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(createClient).mockRejectedValue(
      new Error('reward failed birth_date=1991-03-15 birth_time=14:30 gender=F'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST();

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
