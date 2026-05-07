import { describe, it, expect } from 'vitest';
import { buildSourcePacketHash } from '@/lib/today/cache-key';
import type { ChartCore } from '@/types/chart';

const CHART: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

describe('buildSourcePacketHash', () => {
  it('SHA-256 hex 64자', () => {
    expect(buildSourcePacketHash(CHART, '2026-05-06')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('동일 입력 = 동일 해시 (결정형)', () => {
    const a = buildSourcePacketHash(CHART, '2026-05-06');
    const b = buildSourcePacketHash(CHART, '2026-05-06');
    expect(a).toBe(b);
  });

  it('날짜 다르면 다른 해시', () => {
    const a = buildSourcePacketHash(CHART, '2026-05-06');
    const b = buildSourcePacketHash(CHART, '2026-05-07');
    expect(a).not.toBe(b);
  });

  it('chart_core 필드 다르면 다른 해시', () => {
    const other: ChartCore = { ...CHART, day_master_element: '수' };
    const a = buildSourcePacketHash(CHART, '2026-05-06');
    const b = buildSourcePacketHash(other, '2026-05-06');
    expect(a).not.toBe(b);
  });
});
