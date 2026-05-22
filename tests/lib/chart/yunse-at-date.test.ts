import { describe, expect, it } from 'vitest';
import { computeYunseAtDate, kstDateToReferenceDate, withYunseAtDate } from '@/lib/chart/yunse-at-date';
import { mockChartCoreSelf } from '../../fixtures/hapcard';

const BIRTH = {
  birth_date: '1990-01-01',
  birth_date_calendar: 'solar' as const,
  is_lunar_leap: false,
  birth_time_knowledge: 'unknown' as const,
  birth_time: null,
  gender: 'M' as const,
};

describe('kstDateToReferenceDate', () => {
  it('KST 날짜 문자열을 같은 KST 날짜의 기준 Date로 변환한다', () => {
    const ref = kstDateToReferenceDate('2026-05-21');
    const kst = new Date(ref.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    expect(kst).toBe('2026-05-21');
  });

  it('잘못된 날짜 형식은 거부한다', () => {
    expect(() => kstDateToReferenceDate('2026/05/21')).toThrow('INVALID_TARGET_DATE');
  });
});

describe('computeYunseAtDate', () => {
  it('iliun.today_date를 target_date로 계산한다', () => {
    const yunse = computeYunseAtDate(BIRTH, '2026-05-21');
    expect(yunse.iliun.today_date).toBe('2026-05-21');
    expect(yunse.wolun.current_month).toBe('2026-05');
  });

  it('target_date가 바뀌면 일운 날짜가 바뀐다', () => {
    const a = computeYunseAtDate(BIRTH, '2026-05-21');
    const b = computeYunseAtDate(BIRTH, '2026-05-22');
    expect(a.iliun.today_date).toBe('2026-05-21');
    expect(b.iliun.today_date).toBe('2026-05-22');
  });
});

describe('withYunseAtDate', () => {
  it('기존 사주 핵심값은 유지하고 yunse만 target_date 기준으로 교체한다', () => {
    const result = withYunseAtDate(mockChartCoreSelf, BIRTH, '2026-05-21');
    expect(result.day_pillar).toBe(mockChartCoreSelf.day_pillar);
    expect(result.five_elements_counts).toEqual(mockChartCoreSelf.five_elements_counts);
    expect(result.yunse.iliun.today_date).toBe('2026-05-21');
  });
});
