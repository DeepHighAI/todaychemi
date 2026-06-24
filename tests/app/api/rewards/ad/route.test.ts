import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/today/kst-date', () => ({ todayKST: () => '2026-06-24' }));
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');

import { GET, POST } from '@/app/api/rewards/ad/route';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const rpc = vi.fn();
const ledger = {
  select: vi.fn(),
  eq: vi.fn(),
  like: vi.fn(),
};
const policy = {
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
};

function makeUserClient(user: { id: string } | null = { id: USER_ID }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table !== 'token_ledger') throw new Error(`unexpected table ${table}`);
      return ledger;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ledger.select.mockReturnValue(ledger);
  ledger.eq.mockReturnValue(ledger);
  ledger.like.mockResolvedValue({ count: 1, error: null });
  policy.select.mockReturnValue(policy);
  policy.eq.mockReturnValue(policy);
  policy.maybeSingle.mockResolvedValue({
    data: { amount: 10, daily_cap: 3, enabled: true },
    error: null,
  });
  rpc.mockResolvedValue({
    data: {
      awarded: true,
      reason: 'AWARDED',
      amount_awarded: 10,
      daily_cap: 3,
      balance_after: 20,
      remaining: 2,
    },
    error: null,
  });
  vi.mocked(createClient).mockResolvedValue(makeUserClient() as never);
  vi.mocked(createServiceRoleClient).mockReturnValue({
    rpc,
    from: vi.fn((table: string) => {
      if (table !== 'reward_policy_settings') throw new Error(`unexpected service table ${table}`);
      return policy;
    }),
  } as never);
});

describe('GET /api/rewards/ad', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(makeUserClient(null) as never);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(ledger.select).not.toHaveBeenCalled();
  });

  it('returns daily cap status for KST ad_reward references', async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(ledger.select).toHaveBeenCalledWith('ledger_id', { count: 'exact', head: true });
    expect(ledger.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(ledger.eq).toHaveBeenCalledWith('reason', 'bonus');
    expect(ledger.like).toHaveBeenCalledWith('reference_id', 'ad_reward:2026-06-24:%');
    expect(policy.select).toHaveBeenCalledWith('amount,daily_cap,enabled');
    expect(policy.eq).toHaveBeenCalledWith('reward_key', 'rewarded_ad');
    expect(body.reward).toEqual({
      amount_awarded: 10,
      daily_cap: 3,
      awarded_today: 1,
      remaining: 2,
    });
  });

  it('caps remaining at zero when three or more rewards already exist', async () => {
    ledger.like.mockResolvedValue({ count: 3, error: null });

    const res = await GET();
    const body = await res.json();

    expect(body.reward.remaining).toBe(0);
  });
});

describe('POST /api/rewards/ad', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(makeUserClient(null) as never);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls rewarded ad service-role RPC and returns the grant result', async () => {
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('award_rewarded_ad_talisman', { uid: USER_ID });
    expect(body).toEqual({
      ok: true,
      reward: {
        awarded: true,
        reason: 'AWARDED',
        amount_awarded: 10,
        daily_cap: 3,
        balance_after: 20,
        remaining: 2,
      },
    });
  });

  it('returns profile-required as a non-fatal reward result', async () => {
    rpc.mockResolvedValue({
      data: {
        awarded: false,
        reason: 'PROFILE_REQUIRED',
        amount_awarded: 0,
        balance_after: null,
        remaining: 0,
      },
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reward.reason).toBe('PROFILE_REQUIRED');
  });

  it('returns daily limit as a successful idempotent result', async () => {
    rpc.mockResolvedValue({
      data: {
        awarded: false,
        reason: 'DAILY_LIMIT_REACHED',
        amount_awarded: 0,
        balance_after: 30,
        remaining: 0,
      },
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reward.reason).toBe('DAILY_LIMIT_REACHED');
  });

  it('returns 500 on RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
