import { describe, expect, it, vi } from 'vitest';

import { isFeatureUnlocked } from '@/lib/payments/feature-unlock';

const USER_ID = 'user-uuid-001';
const REF = 'cache-key-abc';

// token_ledger / payments 쿼리는 모두 .select().eq()*.limit(1).maybeSingle() 형태.
function makeChain(maybeData: unknown) {
  const eqCalls: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'limit', 'order', 'in', 'gte']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.eq = vi.fn((col: string, val: unknown) => {
    eqCalls.push([col, val]);
    return builder;
  });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: maybeData, error: null });
  return { builder, eqCalls };
}

function makeService(opts: { ledger?: unknown; payment?: unknown } = {}) {
  const ledger = makeChain(opts.ledger ?? null);
  const payment = makeChain(opts.payment ?? null);
  const from = vi.fn((table: string) => {
    if (table === 'token_ledger') return ledger.builder;
    if (table === 'payments') return payment.builder;
    throw new Error(`unexpected table ${table}`);
  });
  return { service: { from } as never, ledger, payment, from };
}

describe('isFeatureUnlocked (pay-per-use 단일 잠금 게이트)', () => {
  it('무료 경로 — token_ledger 에 {feature}_use(ref) 존재 → unlocked', async () => {
    const { service, ledger, from } = makeService({ ledger: { ledger_id: 'l-1' } });

    const result = await isFeatureUnlocked(service, USER_ID, 'hapcard', REF);

    expect(result).toBe(true);
    // 올바른 reason / reference_id 로 조회했는지 검증
    expect(ledger.eqCalls).toContainEqual(['user_id', USER_ID]);
    expect(ledger.eqCalls).toContainEqual(['reason', 'hapcard_use']);
    expect(ledger.eqCalls).toContainEqual(['reference_id', REF]);
    // 무료 경로에서 잠금해제되면 payments 는 조회하지 않는다 (단락).
    expect(from).not.toHaveBeenCalledWith('payments');
  });

  it('현금 경로 — ledger 없음 + payments confirmed(feature_ref) 존재 → unlocked', async () => {
    const { service, payment } = makeService({ ledger: null, payment: { payment_id: 'p-1' } });

    const result = await isFeatureUnlocked(service, USER_ID, 'whatif', REF);

    expect(result).toBe(true);
    expect(payment.eqCalls).toContainEqual(['feature_id', 'whatif']);
    expect(payment.eqCalls).toContainEqual(['feature_ref', REF]);
    expect(payment.eqCalls).toContainEqual(['status', 'confirmed']);
  });

  it('둘 다 없음 → locked (false)', async () => {
    const { service } = makeService({ ledger: null, payment: null });

    const result = await isFeatureUnlocked(service, USER_ID, 'replay', REF);

    expect(result).toBe(false);
  });
});
