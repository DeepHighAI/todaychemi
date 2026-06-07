import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ensureRelationChart } from '@/lib/today/lazy-relation-chart';

// G2 / Phase 3 F3.1 — relation chart 미존재 시 KASI computeChart → relation_charts upsert
// 흐름: 기존 chart 있으면 그대로 반환 / 없으면 relations 테이블 row → computeChart → upsert → 반환
// KASI 실패 시 graceful null + 로깅.

vi.mock('@/lib/chart/queries', () => ({
  fetchLatestRelationChartForVersion: vi.fn(),
}));

vi.mock('@/lib/chart/compute', () => ({
  computeChart: vi.fn(),
}));

import { fetchLatestRelationChartForVersion } from '@/lib/chart/queries';
import { computeChart } from '@/lib/chart/compute';

const EXISTING_CHART = {
  year_pillar: '甲子',
  month_pillar: '乙丑',
  day_pillar: '丙寅',
  hour_pillar: null,
  day_master_element: '화' as const,
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M' as const,
  yunse: {
    daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 },
    seyun: { current_pillar: '병오', current_year: 2026 },
    wolun: { current_pillar: '계사', current_month: '2026-05' },
    iliun: { today_pillar: '갑자', today_date: '2026-05-28' },
  },
};

const COMPUTED_CHART = {
  ...EXISTING_CHART,
  day_pillar: '辛巳',
};

// supabase mock factory
function makeSupabase(opts: {
  relationRow?: {
    birth_date: string;
    birth_date_calendar: 'solar' | 'lunar';
    is_lunar_leap: boolean;
    birth_time_knowledge: 'exact' | 'approximate' | 'unknown';
    birth_time: string | null;
    gender: 'M' | 'F';
  } | null;
  relationLookupError?: unknown;
  upsertError?: unknown;
}) {
  const upsertMock = vi.fn().mockResolvedValue({ data: null, error: opts.upsertError ?? null });
  const sb = {
    from: vi.fn((table: string) => {
      if (table === 'relations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: opts.relationRow,
            error: opts.relationLookupError ?? null,
          }),
        };
      }
      if (table === 'relation_charts') {
        return { upsert: upsertMock };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    }),
  };
  return { sb, upsertMock };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureRelationChart', () => {
  it('기존 chart 있으면 그대로 반환 (computeChart 미호출)', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: { chart_core: EXISTING_CHART, chart_hash: 'h1' },
      error: null,
    } as never);

    const { sb } = makeSupabase({});
    const result = await ensureRelationChart(sb as never, 'rel-x', 'user-1', 'kasi-key');

    expect(result).toEqual(EXISTING_CHART);
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('기존 chart 없음 + relations row 존재 → computeChart 호출 + relation_charts upsert + chart 반환', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never);
    vi.mocked(computeChart).mockResolvedValueOnce({
      chart_core: COMPUTED_CHART,
      chart_hash: 'h-new',
    });

    const { sb, upsertMock } = makeSupabase({
      relationRow: {
        birth_date: '1995-06-15',
        birth_date_calendar: 'solar',
        is_lunar_leap: false,
        birth_time_knowledge: 'exact',
        birth_time: '10:30:00',
        gender: 'F',
      },
    });

    const result = await ensureRelationChart(sb as never, 'rel-new', 'user-1', 'kasi-key');

    expect(result).toEqual(COMPUTED_CHART);
    expect(computeChart).toHaveBeenCalledOnce();
    expect(upsertMock).toHaveBeenCalledOnce();
    // upsert payload 확인 — relation_id + chart_core 포함
    const upsertArgs = upsertMock.mock.calls[0][0];
    expect(upsertArgs.relation_id).toBe('rel-new');
    expect(upsertArgs.chart_core).toEqual(COMPUTED_CHART);
  });

  it('relations row 없음 (인연 row 자체 미존재) → null 반환 (computeChart 미호출)', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never);

    const { sb } = makeSupabase({ relationRow: null });
    const result = await ensureRelationChart(sb as never, 'rel-missing', 'user-1', 'kasi-key');

    expect(result).toBeNull();
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('KASI computeChart 실패 → null 반환 (graceful fallback)', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never);
    vi.mocked(computeChart).mockRejectedValueOnce(new Error('KASI timeout'));

    const { sb } = makeSupabase({
      relationRow: {
        birth_date: '1995-06-15',
        birth_date_calendar: 'solar',
        is_lunar_leap: false,
        birth_time_knowledge: 'exact',
        birth_time: '10:30:00',
        gender: 'F',
      },
    });

    const result = await ensureRelationChart(sb as never, 'rel-x', 'user-1', 'kasi-key');
    expect(result).toBeNull();
  });

  it('기존 relation_charts 조회 오류는 chart 없음으로 삼키지 않고 전파한다', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST503', message: 'relation_charts lookup failed' },
    } as never);

    const { sb } = makeSupabase({
      relationRow: {
        birth_date: '1995-06-15',
        birth_date_calendar: 'solar',
        is_lunar_leap: false,
        birth_time_knowledge: 'exact',
        birth_time: '10:30:00',
        gender: 'F',
      },
    });

    await expect(ensureRelationChart(sb as never, 'rel-db-error', 'user-1', 'kasi-key')).rejects
      .toMatchObject({ code: 'PGRST503' });
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('relations row 조회 오류는 relation 없음으로 삼키지 않고 전파한다', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never);

    const { sb } = makeSupabase({
      relationRow: null,
      relationLookupError: { code: '57014', message: 'statement timeout' },
    });

    await expect(ensureRelationChart(sb as never, 'rel-row-error', 'user-1', 'kasi-key')).rejects
      .toMatchObject({ code: '57014' });
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('relation_charts upsert 실패는 저장된 chart 처럼 반환하지 않고 전파한다', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never);
    vi.mocked(computeChart).mockResolvedValueOnce({
      chart_core: COMPUTED_CHART,
      chart_hash: 'h-new',
    });

    const { sb } = makeSupabase({
      relationRow: {
        birth_date: '1995-06-15',
        birth_date_calendar: 'solar',
        is_lunar_leap: false,
        birth_time_knowledge: 'exact',
        birth_time: '10:30:00',
        gender: 'F',
      },
      upsertError: { code: '23505', message: 'duplicate key' },
    });

    await expect(ensureRelationChart(sb as never, 'rel-upsert-error', 'user-1', 'kasi-key')).rejects
      .toMatchObject({ code: '23505' });
  });

  // F3.3: KASI 실패 시 error_events 테이블에 기록
  it('F3.3: KASI 실패 → error_events INSERT (error_code=KASI_COMPUTE_FAIL, context에 relationId)', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never);
    vi.mocked(computeChart).mockRejectedValueOnce(new Error('KASI 503'));

    // error_events 테이블 INSERT 캡처를 위한 mock 확장
    const errorInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const sb = {
      from: vi.fn((table: string) => {
        if (table === 'relations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                birth_date: '1995-06-15',
                birth_date_calendar: 'solar',
                is_lunar_leap: false,
                birth_time_knowledge: 'exact',
                birth_time: '10:30:00',
                gender: 'F',
              },
              error: null,
            }),
          };
        }
        if (table === 'error_events') {
          return { insert: errorInsertMock };
        }
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    };

    await ensureRelationChart(sb as never, 'rel-err', 'user-1', 'kasi-key');

    expect(errorInsertMock).toHaveBeenCalledOnce();
    const payload = errorInsertMock.mock.calls[0][0];
    expect(payload.error_code).toBe('KASI_COMPUTE_FAIL');
    expect(payload.user_id).toBe('user-1');
    // context.relation_id 에 식별자 포함
    const context = typeof payload.context === 'string' ? JSON.parse(payload.context) : payload.context;
    expect(context.relation_id).toBe('rel-err');
  });

  it('KASI 실패 error_events.stack 에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(fetchLatestRelationChartForVersion).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never);
    vi.mocked(computeChart).mockRejectedValueOnce(
      new Error('KASI failed birth_date=1995-06-15 birth_time=10:30:00 gender=F'),
    );

    const errorInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const sb = {
      from: vi.fn((table: string) => {
        if (table === 'relations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                birth_date: '1995-06-15',
                birth_date_calendar: 'solar',
                is_lunar_leap: false,
                birth_time_knowledge: 'exact',
                birth_time: '10:30:00',
                gender: 'F',
              },
              error: null,
            }),
          };
        }
        if (table === 'error_events') {
          return { insert: errorInsertMock };
        }
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    };

    await ensureRelationChart(sb as never, 'rel-safe-log', 'user-1', 'kasi-key');

    const payload = errorInsertMock.mock.calls[0][0];
    expect(payload.stack).not.toContain('1995-06-15');
    expect(payload.stack).not.toContain('10:30:00');
    expect(payload.stack).not.toContain('gender=F');
    expect(payload.stack).toContain('birth_date=[redacted]');
    expect(payload.stack).toContain('birth_time=[redacted]');
    expect(payload.stack).toContain('gender=[redacted]');
  });
});
