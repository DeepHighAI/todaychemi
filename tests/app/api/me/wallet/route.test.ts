import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { GET } from '@/app/api/me/wallet/route';
import { createClient } from '@/lib/supabase/server';

const USER_ID = 'user-wallet-001';

function makeClient(opts: {
  userId?: string | null;
  ledgerRows?: unknown[];
  ledgerError?: { message: string } | null;
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: opts.userId === null ? null : { id: opts.userId ?? USER_ID } },
    error: null,
  });
  const limit = vi.fn().mockResolvedValue({
    data: opts.ledgerRows ?? [],
    error: opts.ledgerError ?? null,
  });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { auth: { getUser }, from, limit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/me/wallet', () => {
  it('401 → 미인증', async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient({ userId: null }) as never);

    const res = await GET();

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('200 → 잔액, 최근 원장, 사용량 반환', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({
        ledgerRows: [
          {
            ledger_id: 'l2',
            user_id: USER_ID,
            delta: -4,
            balance_after: 6,
            reason: 'replay_use',
            reference_id: 'hapcard-1',
            created_at: new Date().toISOString(),
          },
          {
            ledger_id: 'l1',
            user_id: USER_ID,
            delta: 10,
            balance_after: 10,
            reason: 'purchase',
            reference_id: 'payment-1',
            created_at: new Date().toISOString(),
          },
        ],
      }) as never,
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.balance.balance).toBe(6);
    expect(body.balance.monthly_used).toBe(4);
    expect(body.ledger).toHaveLength(2);
  });
});
