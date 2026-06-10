import { describe, expect, it, vi } from 'vitest';

import { verifyFeatureRefOwnership } from '@/lib/payments/feature-ref-ownership';

const USER = 'user-uuid-1';

// service-role 체인 빌더 mock — table 별 행 주입 + eq 인자 기록.
function makeService(rowByTable: Record<string, unknown>) {
  const calls: { table: string; eqArgs: [string, unknown][] }[] = [];
  const from = vi.fn((table: string) => {
    const eqArgs: [string, unknown][] = [];
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: unknown) => {
        eqArgs.push([col, val]);
        return chain;
      }),
      maybeSingle: vi.fn(() => {
        calls.push({ table, eqArgs });
        return Promise.resolve({ data: rowByTable[table] ?? null, error: null });
      }),
    };
    return chain;
  });
  return { service: { from } as never, from, calls };
}

describe('verifyFeatureRefOwnership', () => {
  it('hapcard — cache_key+user_id 행 존재 → true, hapcards 테이블 조회', async () => {
    const { service, from, calls } = makeService({ hapcards: { hapcard_id: 'h1' } });

    const owned = await verifyFeatureRefOwnership(service, USER, 'hapcard', 'cache-abc');

    expect(owned).toBe(true);
    expect(from).toHaveBeenCalledWith('hapcards');
    expect(calls[0].eqArgs).toEqual([
      ['cache_key', 'cache-abc'],
      ['user_id', USER],
    ]);
  });

  it('hapcard — 행 없음 → false', async () => {
    const { service } = makeService({});
    expect(await verifyFeatureRefOwnership(service, USER, 'hapcard', 'cache-abc')).toBe(false);
  });

  it('whatif — whatif_results.cache_key+user_id 행 존재 → true', async () => {
    const { service, from, calls } = makeService({ whatif_results: { whatif_id: 'w1' } });

    const owned = await verifyFeatureRefOwnership(service, USER, 'whatif', 'cache-xyz');

    expect(owned).toBe(true);
    expect(from).toHaveBeenCalledWith('whatif_results');
    expect(calls[0].eqArgs).toEqual([
      ['cache_key', 'cache-xyz'],
      ['user_id', USER],
    ]);
  });

  it('replay — ref 파싱(hapcard_id+jinjin_date)으로 hapcard_replays 조회 → true', async () => {
    const { service, from, calls } = makeService({ hapcard_replays: { replay_id: 'r1' } });

    const owned = await verifyFeatureRefOwnership(
      service,
      USER,
      'replay',
      'replay:hap-uuid-1:2026-06-02',
    );

    expect(owned).toBe(true);
    expect(from).toHaveBeenCalledWith('hapcard_replays');
    expect(calls[0].eqArgs).toEqual([
      ['hapcard_id', 'hap-uuid-1'],
      ['jinjin_date', '2026-06-02'],
      ['user_id', USER],
    ]);
  });

  it('replay — 행 없음 → false', async () => {
    const { service } = makeService({});
    expect(
      await verifyFeatureRefOwnership(service, USER, 'replay', 'replay:hap-uuid-1:2026-06-02'),
    ).toBe(false);
  });

  it('replay — 형식 위반 ref → 조회 없이 false', async () => {
    const { service, from } = makeService({ hapcard_replays: { replay_id: 'r1' } });

    expect(await verifyFeatureRefOwnership(service, USER, 'replay', 'garbage')).toBe(false);
    expect(await verifyFeatureRefOwnership(service, USER, 'replay', 'replay:only-one')).toBe(false);
    expect(await verifyFeatureRefOwnership(service, USER, 'replay', 'replay:id:badformat')).toBe(
      false,
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('relation_slot — ref 파싱(pending_id)으로 pending_relation_registrations 조회 → true', async () => {
    const { service, from, calls } = makeService({
      pending_relation_registrations: { pending_id: 'pend-uuid-1' },
    });

    const owned = await verifyFeatureRefOwnership(
      service,
      USER,
      'relation_slot',
      'relation_slot:pend-uuid-1',
    );

    expect(owned).toBe(true);
    expect(from).toHaveBeenCalledWith('pending_relation_registrations');
    // materialized_at 필터 금지 — 이미 결제·머티리얼라이즈된 ref 의 init 재오픈도 통과해야 한다.
    expect(calls[0].eqArgs).toEqual([
      ['pending_id', 'pend-uuid-1'],
      ['user_id', USER],
    ]);
  });

  it('relation_slot — 타인 소유/행 없음 → false', async () => {
    const { service } = makeService({});
    expect(
      await verifyFeatureRefOwnership(service, USER, 'relation_slot', 'relation_slot:pend-uuid-1'),
    ).toBe(false);
  });

  it('relation_slot — 형식 위반 ref → 조회 없이 false', async () => {
    const { service, from } = makeService({
      pending_relation_registrations: { pending_id: 'pend-uuid-1' },
    });

    expect(await verifyFeatureRefOwnership(service, USER, 'relation_slot', 'garbage')).toBe(false);
    expect(await verifyFeatureRefOwnership(service, USER, 'relation_slot', 'relation_slot:')).toBe(
      false,
    );
    expect(
      await verifyFeatureRefOwnership(service, USER, 'relation_slot', 'replay:pend-uuid-1'),
    ).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
