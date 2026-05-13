import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/feed/route';

// 스냅샷 fixture 행 형식 (hapcard_score_snapshots 컬럼 subset)
interface SnapshotRow {
  relation_id: string;
  mode: string;
  compat_score: number;
  created_at: string;
}

// 인연 fixture 행 형식 (relations 컬럼 subset)
interface RelationRow {
  relation_id: string;
  nickname: string;
  mode: string;
  created_at: string;
}

function makeClient(opts: {
  userId?: string | null;
  relations?: RelationRow[] | null;
  relationsError?: { code: string; message: string } | null;
  snapshots?: SnapshotRow[] | null;
  snapshotsError?: { code: string; message: string } | null;
}) {
  const userId = opts.userId === undefined ? 'user-uuid-001' : opts.userId;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  // relations 체인: select → order → limit → {data, error}
  const relationsLimit = vi.fn().mockResolvedValue({
    data: opts.relations ?? [],
    error: opts.relationsError ?? null,
  });
  const relationsOrder = vi.fn().mockReturnValue({ limit: relationsLimit });
  const relationsSelect = vi.fn().mockReturnValue({ order: relationsOrder });

  // snapshots 체인: select → gte → order → limit → {data, error}
  const snapshotsLimit = vi.fn().mockResolvedValue({
    data: opts.snapshots ?? [],
    error: opts.snapshotsError ?? null,
  });
  const snapshotsOrder = vi.fn().mockReturnValue({ limit: snapshotsLimit });
  const snapshotsGte = vi.fn().mockReturnValue({ order: snapshotsOrder });
  const snapshotsSelect = vi.fn().mockReturnValue({ gte: snapshotsGte });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'relations') return { select: relationsSelect };
    if (table === 'hapcard_score_snapshots') return { select: snapshotsSelect };
    return { select: vi.fn() };
  });

  return {
    auth: { getUser },
    from,
    _relationsOrder: relationsOrder,
    _relationsLimit: relationsLimit,
    _snapshotsOrder: snapshotsOrder,
    _snapshotsGte: snapshotsGte,
    _snapshotsLimit: snapshotsLimit,
    _relationsSelect: relationsSelect,
    _snapshotsSelect: snapshotsSelect,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/feed', () => {
  it('401 → UNAUTHORIZED (미인증)', async () => {
    const client = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    // 인증 실패 시 DB 조회 없음
    expect(client._relationsSelect).not.toHaveBeenCalled();
    expect(client._snapshotsSelect).not.toHaveBeenCalled();
  });

  it('200 → 응답 shape 계약 (FeedItem 7개 필드)', async () => {
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshots: [
        { relation_id: 'r1', mode: '친구합', compat_score: 72.5, created_at: '2026-05-05T09:00:00Z' },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    const item = body.items[0];
    // 7개 필드 존재 확인
    expect(item).toHaveProperty('relation_id');
    expect(item).toHaveProperty('nickname');
    expect(item).toHaveProperty('mode');
    expect(item).toHaveProperty('compat_score');
    expect(item).toHaveProperty('change_score');
    expect(item).toHaveProperty('has_significant_change');
    expect(item).toHaveProperty('created_at');
    // limit/gte 호출 인수 검증
    expect(client._relationsLimit).toHaveBeenCalledWith(200);
    expect(client._snapshotsGte).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(client._snapshotsLimit).toHaveBeenCalledWith(1000);
  });

  it('200 → 스냅샷 0건인 인연: compat_score=null, change_score=0, has_significant_change=false', async () => {
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshots: [],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    const item = body.items[0];
    expect(item.compat_score).toBeNull();
    expect(item.change_score).toBe(0);
    expect(item.has_significant_change).toBe(false);
  });

  it('200 → 스냅샷 1건: compat_score 반환, change_score=0, has_significant_change=false', async () => {
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshots: [
        { relation_id: 'r1', mode: '친구합', compat_score: 65, created_at: '2026-05-05T09:00:00Z' },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    const body = await res.json();
    const item = body.items[0];
    expect(item.compat_score).toBe(65);
    expect(item.change_score).toBe(0);
    expect(item.has_significant_change).toBe(false);
  });

  it('200 → 스냅샷 2건, |Δ| < 10: change_score = latest - prev, has_significant_change=false', async () => {
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshots: [
        // created_at desc 순으로 이미 정렬됨 (API가 이렇게 받는다)
        { relation_id: 'r1', mode: '친구합', compat_score: 72, created_at: '2026-05-06T09:00:00Z' },
        { relation_id: 'r1', mode: '친구합', compat_score: 67, created_at: '2026-05-05T09:00:00Z' },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    const body = await res.json();
    const item = body.items[0];
    expect(item.compat_score).toBe(72);
    expect(item.change_score).toBe(5);       // 72 - 67 = 5 (|5| < 10)
    expect(item.has_significant_change).toBe(false);
  });

  it('200 → 스냅샷 2건, Δ ≥ +10: has_significant_change=true', async () => {
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshots: [
        { relation_id: 'r1', mode: '친구합', compat_score: 82, created_at: '2026-05-06T09:00:00Z' },
        { relation_id: 'r1', mode: '친구합', compat_score: 65, created_at: '2026-05-05T09:00:00Z' },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    const body = await res.json();
    const item = body.items[0];
    expect(item.change_score).toBe(17);      // 82 - 65 = 17 (|17| >= 10)
    expect(item.has_significant_change).toBe(true);
  });

  it('200 → 스냅샷 2건, Δ ≤ −10: has_significant_change=true (abs 검증)', async () => {
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshots: [
        { relation_id: 'r1', mode: '친구합', compat_score: 50, created_at: '2026-05-06T09:00:00Z' },
        { relation_id: 'r1', mode: '친구합', compat_score: 68, created_at: '2026-05-05T09:00:00Z' },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    const body = await res.json();
    const item = body.items[0];
    expect(item.change_score).toBe(-18);     // 50 - 68 = -18 (|-18| >= 10)
    expect(item.has_significant_change).toBe(true);
  });

  it('200 → mode 불일치 스냅샷 무시: 친구합 인연에 썸합 스냅샷만 있으면 0건 취급', async () => {
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshots: [
        // mode 불일치 — 친구합 인연인데 썸합 스냅샷
        { relation_id: 'r1', mode: '썸합', compat_score: 90, created_at: '2026-05-06T09:00:00Z' },
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    const body = await res.json();
    const item = body.items[0];
    expect(item.compat_score).toBeNull();
    expect(item.change_score).toBe(0);
    expect(item.has_significant_change).toBe(false);
  });

  it('200 → ADR-036 서버 정렬: has_significant_change=true 인연이 오래된 것이어도 상단에', async () => {
    // R1: 최신 (no badge), R2: 중간 (badge=true), R3: 가장 오래됨 (no badge)
    // 기대 순서: [R2, R1, R3]
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-07T10:00:00Z' },
        { relation_id: 'r2', nickname: '여름새', mode: '오래합', created_at: '2026-05-06T10:00:00Z' },
        { relation_id: 'r3', nickname: '가을잎', mode: '썸합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshots: [
        // r2 — badge 대상 (+15점)
        { relation_id: 'r2', mode: '오래합', compat_score: 85, created_at: '2026-05-07T08:00:00Z' },
        { relation_id: 'r2', mode: '오래합', compat_score: 70, created_at: '2026-05-06T08:00:00Z' },
        // r1 — badge 없음 (+3점)
        { relation_id: 'r1', mode: '친구합', compat_score: 73, created_at: '2026-05-07T07:00:00Z' },
        { relation_id: 'r1', mode: '친구합', compat_score: 70, created_at: '2026-05-06T07:00:00Z' },
        // r3 — 스냅샷 없음
      ],
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    const body = await res.json();
    expect(body.items[0].relation_id).toBe('r2');   // badge=true → 최상단
    expect(body.items[1].relation_id).toBe('r1');   // badge=false, 최신
    expect(body.items[2].relation_id).toBe('r3');   // badge=false, 오래됨
  });

  it('200 → 인연 0건: items = []', async () => {
    const client = makeClient({ relations: [], snapshots: [] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('500 → INTERNAL_ERROR (relations SELECT 실패)', async () => {
    const client = makeClient({
      relationsError: { code: 'PGRST000', message: 'DB down' },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('500 → INTERNAL_ERROR (snapshots SELECT 실패)', async () => {
    const client = makeClient({
      relations: [
        { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      ],
      snapshotsError: { code: 'PGRST000', message: 'Snapshot query failed' },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
