import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chart/compute');

import { computeChart } from '@/lib/chart/compute';
import { insertRelationAndComputeChart, RelationInsertError } from '@/lib/relations/insert';
import type { RelationCreate } from '@/types/relation';
import type { ChartCore } from '@/types/chart';

const USER = 'user-uuid-001';

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

const MOCK_CHART_CORE: ChartCore = {
  year_pillar: '辛未', month_pillar: '癸卯', day_pillar: '甲戌', hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};
const MOCK_CHART_HASH = 'b'.repeat(64);

function makeDb(opts: {
  insertError?: { code: string; message: string } | null;
  insertedRows?: Array<{ relation_id?: string }> | null;
  upsertChartError?: { code: string; message: string } | null;
}) {
  const upsertCharts = vi.fn().mockResolvedValue({
    data: null,
    error: opts.upsertChartError ?? null,
  });

  const selectAfterInsert = vi.fn().mockResolvedValue({
    data: opts.insertError ? null : (opts.insertedRows ?? [{ relation_id: 'rel-uuid-001' }]),
    error: opts.insertError ?? null,
  });
  const insertRelations = vi.fn().mockReturnValue({ select: selectAfterInsert });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'relations') return { insert: insertRelations };
    if (table === 'relation_charts') return { upsert: upsertCharts };
    return { insert: vi.fn(), upsert: vi.fn() };
  });

  return { db: { from } as never, _insert: insertRelations, _upsertCharts: upsertCharts };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(computeChart).mockResolvedValue({
    chart_core: MOCK_CHART_CORE,
    chart_hash: MOCK_CHART_HASH,
  });
});

describe('insertRelationAndComputeChart', () => {
  it('INSERT 성공 → relation_id 반환, user_id + draft 필드 전달', async () => {
    const { db, _insert } = makeDb({});

    const relationId = await insertRelationAndComputeChart(db, USER, DRAFT);

    expect(relationId).toBe('rel-uuid-001');
    const inserted = _insert.mock.calls[0][0];
    expect(inserted.user_id).toBe(USER);
    expect(inserted.nickname).toBe('봄달');
    expect(inserted.mode).toBe('친구합');
    expect(inserted.birth_date).toBe('1995-07-20');
    expect(inserted.consent_confirmed).toBe(true);
  });

  it('INSERT 실패 → throw, 차트 컴퓨트 미호출', async () => {
    const { db } = makeDb({ insertError: { code: 'PGRST000', message: 'DB down' } });

    await expect(insertRelationAndComputeChart(db, USER, DRAFT)).rejects.toThrow();
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('INSERT 성공처럼 보이나 relation_id row 없음 → throw', async () => {
    const { db } = makeDb({ insertedRows: [] });

    await expect(insertRelationAndComputeChart(db, USER, DRAFT)).rejects.toThrow();
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('성공 시 relation_charts upsert (chart_hash onConflict)', async () => {
    const { db, _upsertCharts } = makeDb({});

    await insertRelationAndComputeChart(db, USER, DRAFT);

    expect(_upsertCharts).toHaveBeenCalledOnce();
    const [payload, options] = _upsertCharts.mock.calls[0];
    expect(payload.relation_id).toBe('rel-uuid-001');
    expect(payload.user_id).toBe(USER);
    expect(payload.chart_hash).toBe(MOCK_CHART_HASH);
    expect(payload.chart_core).toEqual(MOCK_CHART_CORE);
    expect(options).toEqual({ onConflict: 'chart_hash' });
  });

  it('computeChart 실패 → relation_id 반환 (best-effort, PII-free 로깅)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(computeChart).mockRejectedValue(
      new Error('KASI timeout birth_date=1995-07-20 birth_time=09:00 gender=F'),
    );
    const { db, _upsertCharts } = makeDb({});

    const relationId = await insertRelationAndComputeChart(db, USER, DRAFT);

    expect(relationId).toBe('rel-uuid-001');
    expect(_upsertCharts).not.toHaveBeenCalled();
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).not.toContain('1995-07-20');
    expect(logged).not.toContain('09:00');
    expect(logged).not.toContain('gender=F');
    consoleSpy.mockRestore();
  });

  it('명시적 relationId 전달 시 INSERT 페이로드에 relation_id 고정 (pk 멱등 재시도용)', async () => {
    const { db, _insert } = makeDb({ insertedRows: [{ relation_id: 'fixed-uuid-9' }] });

    const relationId = await insertRelationAndComputeChart(db, USER, DRAFT, 'fixed-uuid-9');

    expect(relationId).toBe('fixed-uuid-9');
    const inserted = _insert.mock.calls[0][0];
    expect(inserted.relation_id).toBe('fixed-uuid-9');
  });

  it('명시적 relationId 미전달 시 INSERT 페이로드에 relation_id 없음 (DB default)', async () => {
    const { db, _insert } = makeDb({});

    await insertRelationAndComputeChart(db, USER, DRAFT);

    const inserted = _insert.mock.calls[0][0];
    expect('relation_id' in inserted).toBe(false);
  });

  it('INSERT 실패 시 RelationInsertError 로 DB 에러 코드를 노출한다', async () => {
    const { db } = makeDb({ insertError: { code: '23505', message: 'duplicate key' } });

    await expect(insertRelationAndComputeChart(db, USER, DRAFT, 'fixed-uuid-9')).rejects.toThrow(
      RelationInsertError,
    );
    await expect(
      insertRelationAndComputeChart(db, USER, DRAFT, 'fixed-uuid-9'),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('relation_charts upsert 실패 → relation_id 반환 + 에러 로깅', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { db } = makeDb({ upsertChartError: { code: 'PGRST000', message: 'upsert fail' } });

    const relationId = await insertRelationAndComputeChart(db, USER, DRAFT);

    expect(relationId).toBe('rel-uuid-001');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[relations] relation_charts upsert failed',
      expect.objectContaining({ error_code: 'PGRST000' }),
    );
    consoleSpy.mockRestore();
  });
});
