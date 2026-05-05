import { describe, it, expect } from 'vitest';
import { toPercent } from '@/lib/hapcard/ohaeng-percent';

const ELEMENTS = ['목', '화', '토', '금', '수'] as const;

describe('toPercent', () => {
  it('합이 100이 되어야 함 (정규화)', () => {
    const result = toPercent({ 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 });
    const total = ELEMENTS.reduce((s, e) => s + result[e], 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it('비율이 count/sum * 100', () => {
    const result = toPercent({ 목: 4, 화: 0, 토: 0, 금: 0, 수: 0 });
    expect(result['목']).toBeCloseTo(100);
    expect(result['화']).toBeCloseTo(0);
  });

  it('모두 0이면 0/0/0/0/0 (divide-by-zero 가드)', () => {
    const result = toPercent({ 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 });
    ELEMENTS.forEach((e) => expect(result[e]).toBe(0));
  });

  it('빈 객체({}) → 0/0/0/0/0', () => {
    const result = toPercent({} as Record<'목' | '화' | '토' | '금' | '수', number>);
    ELEMENTS.forEach((e) => expect(result[e]).toBe(0));
  });

  it('음수 count가 있으면 throw', () => {
    expect(() => toPercent({ 목: -1, 화: 0, 토: 0, 금: 0, 수: 0 })).toThrow();
  });
});
