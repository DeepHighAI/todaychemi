// @vitest-environment node

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { normalizeKasiToChartCore } from '@/lib/kasi/normalize';
import type { KasiLunCalItem } from '@/lib/kasi/types';

const baseItem: KasiLunCalItem = {
  lunSecha: '庚午',
  lunWolgeon: '庚子',
  lunIljin: '壬子',
  lunYear: 1990,
  lunMonth: 2,
  lunDay: 19,
  lunLeapmonth: 'false',
};

const baseBirthInput = { year: 1990, month: 4, day: 15, hour: 10, minute: 0, calendar: 'solar' as const };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-07T12:00:00+09:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('normalizeKasiToChartCore — yunse', () => {
  it('daeun.list is non-empty and start_age >= 0', () => {
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.yunse.daeun.list.length).toBeGreaterThan(0);
    expect(core.yunse.daeun.start_age).toBeGreaterThanOrEqual(0);
  });

  it('daeun.list items have age, pillar, year', () => {
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    const first = core.yunse.daeun.list[0];
    expect(typeof first.age).toBe('number');
    expect(typeof first.pillar).toBe('string');
    expect(first.pillar.length).toBeGreaterThanOrEqual(2);
    expect(typeof first.year).toBe('number');
  });

  it('daeun.current_index is valid (>= 0, < list.length)', () => {
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.yunse.daeun.current_index).toBeGreaterThanOrEqual(0);
    expect(core.yunse.daeun.current_index).toBeLessThan(core.yunse.daeun.list.length);
  });

  it('seyun.current_pillar is a non-empty string', () => {
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.yunse.seyun.current_pillar).toBeTruthy();
    expect(core.yunse.seyun.current_year).toBe(2026);
  });

  it('wolun.current_pillar is non-empty, current_month matches KST YYYY-MM', () => {
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.yunse.wolun.current_pillar).toBeTruthy();
    expect(core.yunse.wolun.current_month).toBe('2026-05');
  });

  it('iliun.today_pillar is non-empty, today_date matches KST YYYY-MM-DD', () => {
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.yunse.iliun.today_pillar).toBeTruthy();
    expect(core.yunse.iliun.today_date).toBe('2026-05-07');
  });
});
