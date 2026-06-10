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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(insertRelationAndComputeChart).mockImplementation(
    async (_db, _userId, _draft, relationId) => relationId ?? 'generated-id',
  );
});

describe('materializeRelationSlot', () => {
  it('미머티리얼라이즈 pending → 클레임(materialized_at+relation_id 기록) 후 고정 id 로 INSERT', async () => {
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [{ data: pendingRow(), error: null }],
      'pending_relation_registrations:update': [{ data: [{ pending_id: PENDING }], error: null }],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    // 클레임 UPDATE: materialized_at + relation_id 동시 기록, materialized_at IS NULL 가드
    const claim = ops.find((o) => o.op === 'update');
    expect(claim).toBeDefined();
    const payload = claim!.payload as Record<string, unknown>;
    expect(payload.materialized_at).toEqual(expect.any(String));
    expect(payload.relation_id).toEqual(expect.any(String));
    expect(claim!.filters).toEqual(
      expect.arrayContaining([
        ['pending_id', PENDING],
        ['user_id', USER],
        ['is:materialized_at', null],
      ]),
    );

    // INSERT 는 클레임에 기록된 uuid 로 고정
    expect(insertRelationAndComputeChart).toHaveBeenCalledWith(
      service,
      USER,
      DRAFT,
      payload.relation_id,
    );
    expect(relationId).toBe(payload.relation_id);
  });

  it('멱등: 이미 머티리얼라이즈 + relations 행 존재 → INSERT 없이 기존 id 반환', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow({ relation_id: 'rel-uuid-9', materialized_at: '2026-06-10T00:00:00Z' }), error: null },
      ],
      'relations:select': [{ data: { relation_id: 'rel-uuid-9' }, error: null }],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBe('rel-uuid-9');
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('크래시 복구: 머티리얼라이즈 기록은 있으나 relations 행 없음 → 기록된 id 로 재INSERT', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow({ relation_id: 'rel-uuid-9', materialized_at: '2026-06-10T00:00:00Z' }), error: null },
      ],
      'relations:select': [{ data: null, error: null }],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBe('rel-uuid-9');
    expect(insertRelationAndComputeChart).toHaveBeenCalledWith(service, USER, DRAFT, 'rel-uuid-9');
  });

  it('크래시 복구 재INSERT 가 23505(pk 중복) → 성공 취급', async () => {
    vi.mocked(insertRelationAndComputeChart).mockRejectedValue(
      new RelationInsertError('relations insert failed: 23505', '23505'),
    );
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow({ relation_id: 'rel-uuid-9', materialized_at: '2026-06-10T00:00:00Z' }), error: null },
      ],
      'relations:select': [{ data: null, error: null }],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBe('rel-uuid-9');
  });

  it('삭제로 소비된 슬롯(materialized_at 有 + relation_id NULL) → null 반환, 재생성 금지', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow({ relation_id: null, materialized_at: '2026-06-10T00:00:00Z' }), error: null },
      ],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBeNull();
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('클레임 race 패배(0행) → 재조회로 승자 id 에 수렴', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow(), error: null },
        // 재조회: 승자가 이미 클레임 완료
        { data: pendingRow({ relation_id: 'winner-id', materialized_at: '2026-06-10T00:00:01Z' }), error: null },
      ],
      'pending_relation_registrations:update': [{ data: [], error: null }],
      'relations:select': [{ data: { relation_id: 'winner-id' }, error: null }],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toBe('winner-id');
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('INSERT 실패(비 23505) → un-claim(자기 relation_id 가드) 후 rethrow', async () => {
    vi.mocked(insertRelationAndComputeChart).mockRejectedValue(
      new RelationInsertError('relations insert failed: PGRST000', 'PGRST000'),
    );
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [{ data: pendingRow(), error: null }],
      'pending_relation_registrations:update': [
        { data: [{ pending_id: PENDING }], error: null }, // 클레임 성공
        { data: [{ pending_id: PENDING }], error: null }, // un-claim
      ],
    });

    await expect(materializeRelationSlot(service, USER, PENDING)).rejects.toThrow();

    const updates = ops.filter((o) => o.op === 'update');
    expect(updates).toHaveLength(2);
    const unclaim = updates[1];
    const unclaimPayload = unclaim.payload as Record<string, unknown>;
    expect(unclaimPayload.materialized_at).toBeNull();
    expect(unclaimPayload.relation_id).toBeNull();
    // 다른 시도의 성공 클레임을 지우지 않도록 자기 relation_id 로 가드
    const claimedId = (updates[0].payload as Record<string, unknown>).relation_id;
    expect(unclaim.filters).toEqual(
      expect.arrayContaining([
        ['pending_id', PENDING],
        ['relation_id', claimedId],
      ]),
    );
  });

  it('INSERT 실패 but 동시 시도가 같은 id 로 이미 전달 → un-claim 금지, 성공 수렴', async () => {
    vi.mocked(insertRelationAndComputeChart).mockRejectedValue(
      new RelationInsertError('relations insert failed: PGRST000', 'PGRST000'),
    );
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [{ data: pendingRow(), error: null }],
      'pending_relation_registrations:update': [{ data: [{ pending_id: PENDING }], error: null }],
      // un-claim 가드 조회: 행이 이미 존재 (동시 race 패자가 전달 완료)
      'relations:select': [{ data: { relation_id: 'any' }, error: null }],
    });

    const relationId = await materializeRelationSlot(service, USER, PENDING);

    expect(relationId).toEqual(expect.any(String));
    // un-claim UPDATE 가 실행되지 않아야 한다 (클레임 1회만)
    const updates = ops.filter((o) => o.op === 'update');
    expect(updates).toHaveLength(1);
  });

  it('클레임 race 패배 후 재조회도 미머티리얼라이즈(승자 un-claim) → 중복 과금 방지 throw', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow(), error: null },
        { data: pendingRow(), error: null }, // 재조회: 여전히 unclaimed
      ],
      'pending_relation_registrations:update': [{ data: [], error: null }],
    });

    await expect(materializeRelationSlot(service, USER, PENDING)).rejects.toThrow(
      'MATERIALIZE_RACE_UNRESOLVED',
    );
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('pending 조회 DB 에러 → throw, 클레임/INSERT 미진행', async () => {
    const { service, ops } = makeService({
      'pending_relation_registrations:select': [
        { data: null, error: { code: 'PGRST000' } },
      ],
    });

    await expect(materializeRelationSlot(service, USER, PENDING)).rejects.toThrow(
      'pending select failed',
    );
    expect(ops.filter((o) => o.op === 'update')).toHaveLength(0);
    expect(insertRelationAndComputeChart).not.toHaveBeenCalled();
  });

  it('수렴 경로 relations 조회 DB 에러 → throw (멱등 판단 불가 시 진행 금지)', async () => {
    const { service } = makeService({
      'pending_relation_registrations:select': [
        { data: pendingRow({ relation_id: 'rel-uuid-9', materialized_at: '2026-06-10T00:00:00Z' }), error: null },
      ],
      'relations:select': [{ data: null, error: { code: 'PGRST000' } }],
    });

    await expect(materializeRelationSlot(service, USER, PENDING)).rejects.toThrow(
      'relations select failed',
    );
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
