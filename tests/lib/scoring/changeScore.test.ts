import { describe, it, expect } from 'vitest';
import { CHANGE_SCORE_THRESHOLD } from '@/lib/scoring/constants';
import { computeChangeScore, topChangedFactors } from '@/lib/scoring/changeScore';
import type { ScoreBreakdown } from '@/types/hapcard';

describe('CHANGE_SCORE_THRESHOLD', () => {
  it('값이 10이다', () => {
    expect(CHANGE_SCORE_THRESHOLD).toBe(10);
  });
});

describe('computeChangeScore', () => {
  it('prev=70 current=82 → 12', () => {
    expect(computeChangeScore(70, 82)).toBe(12);
  });

  it('prev=null → 0 (첫 스냅샷)', () => {
    expect(computeChangeScore(null, 82)).toBe(0);
  });

  it('prev=80 current=80 → 0', () => {
    expect(computeChangeScore(80, 80)).toBe(0);
  });

  it('prev=90 current=72 → -18', () => {
    expect(computeChangeScore(90, 72)).toBe(-18);
  });

  it('소수점 포함 → 반올림 없이 그대로', () => {
    expect(computeChangeScore(70.5, 82.5)).toBeCloseTo(12, 5);
  });
});

describe('topChangedFactors', () => {
  const prev: ScoreBreakdown = {
    hap_chung_hyung_hae: 30,
    sipsin: 40,
    ohaeng: 20,
    yunse_adjustment: 5,
    mode_adjustment: 0,
  };

  const current: ScoreBreakdown = {
    hap_chung_hyung_hae: 35, // +5
    sipsin: 32,               // -8
    ohaeng: 21,               // +1
    yunse_adjustment: 15,     // +10
    mode_adjustment: 0,       // 0
  };

  it('top3 — |delta| 내림차순 정렬', () => {
    const result = topChangedFactors(prev, current, 3);
    expect(result[0]!.factor).toBe('yunse_adjustment');
    expect(result[0]!.delta).toBe(10);
    expect(result[1]!.factor).toBe('sipsin');
    expect(result[1]!.delta).toBe(-8);
    expect(result[2]!.factor).toBe('hap_chung_hyung_hae');
    expect(result[2]!.delta).toBe(5);
  });

  it('prev=null → 빈 배열', () => {
    expect(topChangedFactors(null, current, 3)).toEqual([]);
  });

  it('delta=0 인 factor 제외', () => {
    const result = topChangedFactors(prev, current, 5);
    const modeAdj = result.find((f) => f.factor === 'mode_adjustment');
    expect(modeAdj).toBeUndefined();
  });
});
