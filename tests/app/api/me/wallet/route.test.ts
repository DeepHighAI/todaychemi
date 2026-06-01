import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { GET } from '@/app/api/me/wallet/route';
import { createClient } from '@/lib/supabase/server';

const USER_ID = 'user-wallet-001';

function makeClient(opts: {
  userId?: string | null;
  ledgerRows?: unknown[];
  monthlyRows?: unknown[];
  ledgerError?: { message: string } | null;
  monthlyError?: { message: string } | null;
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: opts.userId === null ? null : { id: opts.userId ?? USER_ID } },
    error: null,
  });
  const recentLedgerQuery = makeQuery({
    data: opts.ledgerRows ?? [],
    error: opts.ledgerError ?? null,
  });
  const monthlyUsageQuery = makeQuery({
    data: opts.monthlyRows ?? opts.ledgerRows ?? [],
    error: opts.monthlyError ?? null,
  });
  const queries = [recentLedgerQuery, monthlyUsageQuery];
  const from = vi.fn(() => {
    const query = queries.shift();
    if (!query) throw new Error('Unexpected Supabase query');
    return query;
  });
  return { auth: { getUser }, from, recentLedgerQuery, monthlyUsageQuery };
}

function makeQuery(result: { data: unknown[]; error: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    lt: vi.fn(() => query),
    gte: vi.fn().mockResolvedValue(result),
    order: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue(result),
  };
  return query;
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
    const recentLedgerRows = [
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
    ];
    const monthlyRows = [
      { delta: -4, created_at: new Date().toISOString() },
      { delta: -6, created_at: new Date().toISOString() },
    ];

    vi.mocked(createClient).mockResolvedValue(
      makeClient({
        ledgerRows: recentLedgerRows,
        monthlyRows,
      }) as never,
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.balance.balance).toBe(6);
    expect(body.balance.monthly_used).toBe(10);
    expect(body.ledger).toHaveLength(2);
  });

  it('월간 사용량은 최근 원장 20개 밖의 이번 달 음수 원장까지 합산한다', async () => {
    const client = makeClient({
      ledgerRows: Array.from({ length: 21 }, (_, index) => ({
        ledger_id: `recent-${index}`,
        user_id: USER_ID,
        delta: index === 0 ? -1 : 1,
        balance_after: 100 - index,
        reason: index === 0 ? 'replay_use' : 'purchase',
        reference_id: `ref-${index}`,
        created_at: new Date().toISOString(),
      })),
      monthlyRows: [
        { delta: -1, created_at: new Date().toISOString() },
        { delta: -4, created_at: new Date().toISOString() },
        { delta: -8, created_at: new Date().toISOString() },
      ],
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.balance.monthly_used).toBe(13);
    expect(body.ledger).toHaveLength(20);
    expect(body.has_more).toBe(true);
    expect(client.monthlyUsageQuery.lt).toHaveBeenCalledWith('delta', 0);
    expect(client.monthlyUsageQuery.gte).toHaveBeenCalledWith('created_at', expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
  });
});
