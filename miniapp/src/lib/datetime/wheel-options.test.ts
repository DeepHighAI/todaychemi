import { describe, expect, it } from 'vitest';

import {
  clampDateToBounds,
  clampDay,
  dayOptions,
  daysInMonth,
  formatDate,
  formatTime,
  hourOptions,
  minuteOptions,
  monthOptions,
  parseDate,
  parseTime,
  yearOptions,
} from './wheel-options';

describe('daysInMonth', () => {
  it('윤년 2월은 29일, 평년 2월은 28일', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
  });
  it('30일/31일 달', () => {
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 1)).toBe(31);
  });
});

describe('옵션 생성', () => {
  it('yearOptions 는 min..max 오름차순 문자열', () => {
    expect(yearOptions(1900, 1902)).toEqual(['1900', '1901', '1902']);
  });
  it('monthOptions 는 01..12 (2자리)', () => {
    const m = monthOptions();
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('01');
    expect(m[11]).toBe('12');
  });
  it('dayOptions 는 해당 월 일수만큼 (2자리)', () => {
    expect(dayOptions(2023, 2)).toHaveLength(28);
    expect(dayOptions(2024, 2)).toHaveLength(29);
    expect(dayOptions(2024, 1)[30]).toBe('31');
  });
  it('hourOptions 00..23, minuteOptions 00..59', () => {
    expect(hourOptions()).toHaveLength(24);
    expect(hourOptions()[0]).toBe('00');
    expect(hourOptions()[23]).toBe('23');
    expect(minuteOptions()).toHaveLength(60);
    expect(minuteOptions()[59]).toBe('59');
  });
});

describe('format/parse', () => {
  it('formatDate 는 YYYY-MM-DD 제로패딩', () => {
    expect(formatDate({ year: 2024, month: 3, day: 5 })).toBe('2024-03-05');
  });
  it('parseDate 는 유효 문자열만 파싱', () => {
    expect(parseDate('1994-09-12')).toEqual({ year: 1994, month: 9, day: 12 });
    expect(parseDate('')).toBeNull();
    expect(parseDate('2024-13-01')).toBeNull();
    expect(parseDate('2024-02-40')).toBeNull();
    expect(parseDate('bad')).toBeNull();
  });
  it('formatTime 는 HH:MM, parseTime 은 유효만', () => {
    expect(formatTime({ hour: 3, minute: 40 })).toBe('03:40');
    expect(parseTime('03:40')).toEqual({ hour: 3, minute: 40 });
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('')).toBeNull();
  });
});

describe('clampDay (월별 일수 보정)', () => {
  it('평년 2월 31일 → 28일', () => {
    expect(clampDay({ year: 2023, month: 2, day: 31 })).toEqual({ year: 2023, month: 2, day: 28 });
  });
  it('윤년 2월 31일 → 29일', () => {
    expect(clampDay({ year: 2024, month: 2, day: 31 })).toEqual({ year: 2024, month: 2, day: 29 });
  });
  it('유효 일자는 그대로', () => {
    expect(clampDay({ year: 2024, month: 3, day: 15 })).toEqual({ year: 2024, month: 3, day: 15 });
  });
});

describe('clampDateToBounds (min/max 경계)', () => {
  const min = { year: 1900, month: 1, day: 1 };
  const max = { year: 2026, month: 6, day: 21 };
  it('범위 내는 그대로', () => {
    expect(clampDateToBounds({ year: 1994, month: 9, day: 12 }, min, max)).toEqual({ year: 1994, month: 9, day: 12 });
  });
  it('min 미만은 min 으로', () => {
    expect(clampDateToBounds({ year: 1850, month: 5, day: 5 }, min, max)).toEqual(min);
  });
  it('max 초과(미래 같은 해)는 max 로', () => {
    expect(clampDateToBounds({ year: 2026, month: 7, day: 1 }, min, max)).toEqual(max);
  });
});
