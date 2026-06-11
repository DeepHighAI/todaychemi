import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chart/compute');

import { computeChart } from '@/lib/chart/compute';
import { ensureUserChartRow } from '@/lib/chart/ensure-user-chart';
import type { ChartCore } from '@/types/chart';

const USER = 'user-uuid-001';

const CHART: ChartCore = {
  year_pillar: '己未',
  month_pillar: '戊辰',
  day_pillar: '戊申',
  hour_pillar: '庚申',
  day_master_element: '토',
  five_elements_counts: { 목: 0, 화: 0, 토: 5, 금: 2, 수: 1 },
  gender_normalized: 'M',
  yunse: { daeun: { start_age: 3, list: [{ age: 3, pillar: '기사', year: 1982 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '갑오', current_month: '2026-06' }, iliun: { today_pillar: '갑자', today_date: '2026-06-11' } },
};

const USER_ROW = {
  birth_date: '1979-04-20',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '17:05',
  gender: 'M',
};

// supabase 체인 mock — user_charts select(현재 버전) / users select / user_charts upsert
function makeService(opts: {
  existingChart?: { chart_core: ChartCore; chart_hash: string } | null;
  userRow?: typeof USER_ROW | null;
  upsertError?: { code: string; message: string } | null;
}) {
  const chartMaybeSingle = vi.fn().mockResolvedValue({ data: opts.existingChart ?? null, error: null });
  const chartLimit = vi.fn().mockReturnValue({ maybeSingle: chartMaybeSingle });
  const chartOrder = vi.fn().mockReturnValue({ limit: chartLimit });
  const chartEq2 = vi.fn().mockReturnValue({ order: chartOrder });
  const chartEq1 = vi.fn().mockReturnValue({ eq: chartEq2 });
  const chartSelect = vi.fn().mockReturnValue({ eq: chartEq1 });
  const upsert = vi.fn().mockResolvedValue({ error: opts.upsertError ?? null });

  const userMaybeSingle = vi.fn().mockResolvedValue({ data: opts.userRow ?? null, error: null });
  const userEq = vi.fn().mockReturnValue({ maybeSingle: userMaybeSingle });
  const userSelect = vi.fn().mockReturnValue({ eq: userEq });

  const from = vi.fn((table: string) => {
    if (table === 'user_charts') return { select: chartSelect, upsert };
    if (table === 'users') return { select: userSelect };
    return {};
  });

  return { service: { from } as never, upsert, userSelect };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(computeChart).mockResolvedValue({ chart_core: CHART, chart_hash: 'a'.repeat(64) });
});

describe('ensureUserChartRow (v2 lazy 재계산 — ADR-021)', () => {
  it('현재 버전 row 존재 → 그대로 반환, compute 미호출', async () => {
    const { service } = makeService({
      existingChart: { chart_core: CHART, chart_hash: 'b'.repeat(64) },
    });

    const got = await ensureUserChartRow(service, USER, 'kasi-key');

    expect(got?.chart_hash).toBe('b'.repeat(64));
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('row 미존재 → users 행으로 computeChart 후 upsert + 반환 (재온보딩 불필요)', async () => {
    const { service, upsert } = makeService({ existingChart: null, userRow: USER_ROW });

    const got = await ensureUserChartRow(service, USER, 'kasi-key', 'v2');

    expect(computeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: USER,
        birth_date: '1979-04-20',
        birth_time: '17:05',
        theory_profile_version: 'v2',
      }),
      'kasi-key',
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER, theory_profile_version: 'v2' }),
      { onConflict: 'chart_hash' },
    );
    expect(got?.chart_core.hour_pillar).toBe('庚申');
  });

  it('users 행 없음(미온보딩) → null, compute 미호출', async () => {
    const { service } = makeService({ existingChart: null, userRow: null });

    const got = await ensureUserChartRow(service, USER, 'kasi-key');

    expect(got).toBeNull();
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('computeChart 실패(KASI) → graceful null + 로깅', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(computeChart).mockRejectedValue(new Error('KASI timeout'));
    const { service, upsert } = makeService({ existingChart: null, userRow: USER_ROW });

    const got = await ensureUserChartRow(service, USER, 'kasi-key');

    expect(got).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
