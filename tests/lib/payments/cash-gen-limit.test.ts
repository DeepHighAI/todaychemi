import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkCashGenLimit,
  DEFAULT_CASH_GEN_DAILY_LIMIT,
} from '@/lib/payments/cash-gen-limit';

const USER_ID = 'user-uuid-001';

// 각 count 쿼리는 .select('*',{count,head}).eq()*.[in()].gte('created_at',start) 형태 — gte 가 종단.
function makeService(counts: Record<string, number>) {
  const fromCalls: string[] = [];
  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in']) builder[m] = vi.fn(() => builder);
    builder.gte = vi.fn(() => Promise.resolve({ count: counts[table] ?? 0, error: null }));
    return builder;
  });
  return { service: { from } as never, from, fromCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('checkCashGenLimit (일일 미결제 선생성 한도)', () => {
  it('미결제 선생성 < 한도 → allowed', async () => {
    // 생성 2건(hapcards 1 + whatif 1), 무료차감 0, 확정결제 0 → 미결제 2 < 5
    const { service } = makeService({ hapcards: 1, whatif_results: 1 });

    const res = await checkCashGenLimit(service, USER_ID);

    expect(res.allowed).toBe(true);
    expect(res.count).toBe(2);
    expect(res.limit).toBe(DEFAULT_CASH_GEN_DAILY_LIMIT);
  });

  it('미결제 선생성 == 한도 → blocked', async () => {
    const { service } = makeService({ hapcards: 5 });

    const res = await checkCashGenLimit(service, USER_ID);

    expect(res.allowed).toBe(false);
    expect(res.count).toBe(5);
  });

  it('무료차감·확정결제 건은 미결제 카운트에서 제외된다', async () => {
    // 생성 6건이지만 무료차감 4 + 확정결제 2 = 6 정산 → 미결제 0
    const { service } = makeService({
      hapcards: 4,
      whatif_results: 1,
      hapcard_replays: 1,
      token_ledger: 4,
      payments: 2,
    });

    const res = await checkCashGenLimit(service, USER_ID);

    expect(res.count).toBe(0);
    expect(res.allowed).toBe(true);
  });

  it('3개 피처 결과 테이블 + token_ledger + payments 를 모두 집계한다', async () => {
    const { service, fromCalls } = makeService({});

    await checkCashGenLimit(service, USER_ID);

    expect(fromCalls).toEqual(
      expect.arrayContaining([
        'hapcards',
        'whatif_results',
        'hapcard_replays',
        'token_ledger',
        'payments',
      ]),
    );
  });

  it('opts.limit 로 한도를 덮어쓸 수 있다', async () => {
    const { service } = makeService({ hapcards: 3 });

    const res = await checkCashGenLimit(service, USER_ID, { limit: 3 });

    expect(res.limit).toBe(3);
    expect(res.allowed).toBe(false);
  });

  it('CASH_GEN_DAILY_LIMIT 환경변수가 기본 한도를 정한다', async () => {
    vi.stubEnv('CASH_GEN_DAILY_LIMIT', '2');
    const { service } = makeService({ hapcards: 2 });

    const res = await checkCashGenLimit(service, USER_ID);

    expect(res.limit).toBe(2);
    expect(res.allowed).toBe(false);
  });
});
