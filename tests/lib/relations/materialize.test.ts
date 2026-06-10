import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/relations/insert', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/relations/insert')>();
  return { ...actual, insertRelationAndComputeChart: vi.fn() };
});

import { insertRelationAndComputeChart, RelationInsertError } from '@/lib/relations/insert';
import { materializeRelationSlot } from '@/lib/relations/materialize';
import type { RelationCreate } from '@/types/relation';

const USER = 'user-uuid-001';
const PENDING = 'pend-uuid-001';

const DRAFT: RelationCreate = {
  nickname: '봄달',
  mode: '친구합',
  gender: 'F',
  birth_date: '1995-07-20',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '09:00',
  birth_longitude: null,
  consent_confirmed: true,
  is_primary: false,
};

type Result = { data: unknown; error: unknown };
type Op = {
  table: string;
  op: 'select' | 'update';
  filters: [string, unknown][];
  payload?: unknown;
};

// supabase 체인 mock — select 는 maybeSingle 종결, update 는 select 종결.
// queue 키 `${table}:${op}` 의 결과를 순서대로 소비한다.
function makeService(queue: Record<string, Result[]>) {
  const ops: Op[] = [];
  const next = (key: string): Result =>
    queue[key]?.shift() ?? { data: null, error: null };

  const from = vi.fn((table: string) => {
    const rec: Op = { table, op: 'select', filters: [] };
    const chain: Record<string, unknown> = {
      select: vi.fn(() => {
        if (rec.op === 'update') {
          ops.push(rec);
          return Promise.resolve(next(`${table}:update`));
        }
        return chain;
      }),
      update: vi.fn((payload: unknown) => {
        rec.op = 'update';
        rec.payload = payload;
        return chain;
      }),
      eq: vi.fn((col: string, val: unknown) => {
        rec.filters.push([col, val]);
        return chain;
      }),
      is: vi.fn((col: string, val: unknown) => {
        rec.filters.push([`is:${col}`, val]);
        return chain;
      }),
      maybeSingle: vi.fn(() => {
        ops.push(rec);
        return Promise.resolve(next(`${table}:select`));
      }),
    };
    return chain;
  });

  return { service: { from } as never, from, ops };
}

function pendingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    pending_id: PENDING,
    user_id: USER,
    draft: DRAFT,
    relation_id: null,
    materialized_at: null,
    delivered_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(insertRelationAndComputeChart).mockImplementation(
    async (_db, _userId, _draft, relationId) => relationId ?? 'generated-id',
  );
});


describe('materializeRelationSlot (delivered_at 상태머신)', () => {
  it('미클레임 pending → 클레임(materialized_at만) 후 relation_id=pending_id 로 INSERT, delivered_at 마킹', async () => {
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [{ data: pendingRow(), error: null }],
      // 클레임 UPDATE + 전달 마킹 UPDATE 2회
      'pending_relation_registrations:update': [
        { data: [{ pending_id: PENDING }], error: null },
        { data: [{ pending_id: PENDING }], error: null },
      ],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    // deterministic — relation_id 는 pending_id 와 동일
    expect(relationId).toBe(PENDING);
    expect(insertRelationAndComputeChart).toHaveBeenCalledWith(service, USER, DRAFT, PENDING);

    const updates = ops.filter((o) => o.op === 'update');
    expect(updates).toHaveLength(2);
    // 클레임: materialized_at 만, relation_id 는 건드리지 않음(FK 위반 방지)
    const claim = updates[0].payload as Record<string, unknown>;
    expect(claim.materialized_at).toEqual(expect.any(String));
    expect('relation_id' in claim).toBe(false);
    expect(updates[0].filters).toEqual(
      expect.arrayContaining([
        ['pending_id', PENDING],
        ['user_id', USER],
        ['is:materialized_at', null],
      ]),
    );
    // 전달 마킹: relation_id(=pending_id, INSERT 후라 FK 충족) + delivered_at
    const mark = updates[1].payload as Record<string, unknown>;
    expect(mark.relation_id).toBe(PENDING);
    expect(mark.delivered_at).toEqual(expect.any(String));
  });

  it('전달 완료(delivered_at 有 + relation_id 有) → INSERT 없이 기존 id 반환', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow({ relation_id: PENDING, materialized_at: '2026-06-10T00:00:00Z', delivered_at: '2026-06-10T00:00:01Z' }), error: null },
      ],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBe(PENDING);
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('삭제 소비(delivered_at 有 + relation_id NULL via FK set null) → null 반환, 재생성 금지', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow({ relation_id: null, materialized_at: '2026-06-10T00:00:00Z', delivered_at: '2026-06-10T00:00:01Z' }), error: null },
      ],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBeNull();
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('크래시 복구(materialized_at 有 + delivered_at NULL) → 클레임 0행이어도 deterministic 재INSERT 후 전달', async () => {
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow({ materialized_at: '2026-06-10T00:00:00Z', delivered_at: null }), error: null },
      ],
      // 클레임 시도(이미 클레임됨 → 0행) + 전달 마킹
      'pending_relation_registrations:update': [
        { data: [], error: null },
        { data: [{ pending_id: PENDING }], error: null },
      ],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBe(PENDING);
    expect(insertRelationAndComputeChart).toHaveBeenCalledWith(service, USER, DRAFT, PENDING);
    const mark = (ops.filter((o) => o.op === 'update').at(-1)!.payload) as Record<string, unknown>;
    expect(mark.delivered_at).toEqual(expect.any(String));
  });

  it('동시 재진입: INSERT 23505(이미 생성) → 멱등 성공, 전달 마킹 후 id 반환', async () => {
    vi.mocked(insertRelationAndComputeChart).mockRejectedValue(
      new RelationInsertError('relations insert failed: 23505', '23505'),
    );
    const { service } = makeService({
      'pending_relation_registrations:select': [{ data: pendingRow(), error: null }],
      'pending_relation_registrations:update': [
        { data: [{ pending_id: PENDING }], error: null },
        { data: [{ pending_id: PENDING }], error: null },
      ],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBe(PENDING);
  });

  it('INSERT 진짜 실패(비 23505) → delivered 마킹 없이 rethrow(호출부 환불)', async () => {
    vi.mocked(insertRelationAndComputeChart).mockRejectedValue(
      new RelationInsertError('relations insert failed: PGRST000', 'PGRST000'),
    );
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [{ data: pendingRow(), error: null }],
      'pending_relation_registrations:update': [{ data: [{ pending_id: PENDING }], error: null }],
    });

    await expect(materializeRelationSlot(service, USER, PENDING)).rejects.toThrow();

    // 클레임 UPDATE 1회만 — 전달 마킹은 실행 안 됨
    const updates = ops.filter((o) => o.op === 'update');
    expect(updates).toHaveLength(1);
    expect((updates[0].payload as Record<string, unknown>).delivered_at).toBeUndefined();
  });

  it('클레임 UPDATE DB 에러 → throw, INSERT 미진행', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [{ data: pendingRow(), error: null }],
      'pending_relation_registrations:update': [{ data: null, error: { code: '23505' } }],
    });

    await expect(materializeRelationSlot(service, USER, PENDING)).rejects.toThrow('pending claim failed');
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('pending 조회 DB 에러 → throw, 클레임/INSERT 미진행', async () => {
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [{ data: null, error: { code: 'PGRST000' } }],
    });

    await expect(materializeRelationSlot(service, USER, PENDING)).rejects.toThrow('pending select failed');
    expect(ops.filter((o) => o.op === 'update')).toHaveLength(0);
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('pending 없음(타인 소유 포함) → throw, 조회는 user_id 로 핀', async () => {
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [{ data: null, error: null }],
    });

    await expect(materializeRelationSlot(service, USER, PENDING)).rejects.toThrow();

    const sel = ops.find((o) => o.op === 'select' && o.table === 'pending_relation_registrations');
    expect(sel!.filters).toEqual(
      expect.arrayContaining([
        ['pending_id', PENDING],
        ['user_id', USER],
      ]),
    );
  });
});
