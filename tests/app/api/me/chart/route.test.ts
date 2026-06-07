import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/me/chart/route';
import type { ChartCore } from '@/types/chart';

const MOCK_CHART_CORE: ChartCore = {
  year_pillar: '辛未',
  month_pillar: '癸卯',
  day_pillar: '甲戌',
  hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

function makeClient(opts: {
  userId?: string | null;
  chartCore?: ChartCore | null;
  selectError?: { code: string; message: string } | null;
}) {
  const userId = opts.userId === undefined ? 'user-001' : opts.userId;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  const maybeSingle = vi.fn().mockResolvedValue({
    data:
      opts.selectError != null
        ? null
        : opts.chartCore !== undefined && opts.chartCore !== null
          ? { chart_core: opts.chartCore }
          : null,
    error: opts.selectError ?? null,
  });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { auth: { getUser }, from };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/me/chart', () => {
  it('200 → chart_core 반환 (정상)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ chartCore: MOCK_CHART_CORE }) as never,
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.chart).toEqual(MOCK_CHART_CORE);
  });

  it('200 → chart=null (사용자가 아직 온보딩하지 않음)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ chartCore: null }) as never,
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.chart).toBeNull();
  });

  it('401 → UNAUTHORIZED (미인증)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ userId: null }) as never,
    );
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('500 → INTERNAL_ERROR (DB 오류)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ selectError: { code: 'X', message: 'fail' } }) as never,
    );
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('outer catch 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    vi.mocked(createServerClient).mockRejectedValue(
      new Error('chart failed birth_date=1991-03-15 birth_time=14:30 gender=F'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await GET();

    expect(res.status).toBe(500);
    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1991-03-15');
    expect(calls).not.toContain('14:30');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });
});
