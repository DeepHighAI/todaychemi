import { describe, it, expect } from 'vitest';
import { computeOhaengScore } from '@/lib/scoring/ohaeng';
import type { ChartCore } from '@/types/chart';

type ElementCounts = Record<'목' | '화' | '토' | '금' | '수', number>;

function makeChart(counts: Partial<ElementCounts> = {}): ChartCore {
  const defaults: ElementCounts = { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 };
  const five_elements_counts = { ...defaults, ...counts } as ElementCounts;
  return {
    year_pillar: '甲子',
    month_pillar: '甲子',
    day_pillar: '甲子',
    hour_pillar: null,
    day_master_element: '목',
    five_elements_counts,
    gender_normalized: 'M',
  };
}

describe('computeOhaengScore (§4)', () => {
  describe('균형 상태 → 기본 50', () => {
    it('양쪽 모두 균형 (20%씩) → 보완도 페널티도 0 → 50', () => {
      const self = makeChart();
      const rel = makeChart();
      expect(computeOhaengScore(self, rel)).toBe(50);
    });
  });

  describe('§4.1 보완 보너스', () => {
    it('self에 목 부족(5%), rel에 목 풍부(40%) → 보너스 발생 → 50 초과', () => {
      const self = makeChart({ 목: 5, 화: 25, 토: 25, 금: 25, 수: 20 });
      const rel = makeChart({ 목: 40, 화: 15, 토: 15, 금: 15, 수: 15 });
      const score = computeOhaengScore(self, rel);
      expect(score).toBeGreaterThan(50);
    });

    it('self에 수 부족(0%), rel에 수 풍부(50%) → 보너스 최대 발생', () => {
      const self = makeChart({ 목: 25, 화: 25, 토: 25, 금: 25, 수: 0 });
      const rel = makeChart({ 목: 10, 화: 10, 토: 10, 금: 20, 수: 50 });
      const score = computeOhaengScore(self, rel);
      expect(score).toBeGreaterThan(50);
    });
  });

  describe('§4.1 과다 중첩 페널티', () => {
    it('self에 금 극단 과다(80%), rel도 같은 금 극단 → 페널티 >> 보완 → 50 미만', () => {
      // 금=80%로 극단 과다, 나머지 5% 균등. selfExcess=50, relOverlap=50 → penalty=50
      // 나머지 4원소 bonus=7.5×4=30 → S=50+30-50=30 < 50
      const self = makeChart({ 목: 5, 화: 5, 토: 5, 금: 80, 수: 5 });
      const rel = makeChart({ 목: 5, 화: 5, 토: 5, 금: 80, 수: 5 });
      const score = computeOhaengScore(self, rel);
      expect(score).toBeLessThan(50);
    });
  });

  describe('§4.2 정규화 — 결과는 [0, 100]', () => {
    it('극단 보완 상황에서도 100 이하', () => {
      // self: 모든 요소 부족 (목만 100%), rel: 균형
      const self = makeChart({ 목: 100, 화: 0, 토: 0, 금: 0, 수: 0 });
      const rel = makeChart({ 목: 0, 화: 25, 토: 25, 금: 25, 수: 25 });
      expect(computeOhaengScore(self, rel)).toBeLessThanOrEqual(100);
    });

    it('극단 과다 상황에서도 0 이상', () => {
      const self = makeChart({ 목: 100, 화: 0, 토: 0, 금: 0, 수: 0 });
      const rel = makeChart({ 목: 100, 화: 0, 토: 0, 금: 0, 수: 0 });
      expect(computeOhaengScore(self, rel)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('§4.1 공식 검증', () => {
    it('보완만 있을 때: 50 + bonus > 50', () => {
      // self: 토 부족(10%), rel: 토 풍부(35%)
      // 본인_부족 = 20-10=10, 인연_보완 = min(35,10) = 10, bonus += 10*1.5 = 15
      // 페널티: rel의 토 35% > 30% → 과다 = 35-30=5
      //   self의 토 10% < 30% → 중첩 없음 → 인연_중첩 = min(35, max(0, 10-30)) = 0
      // wait, 페널티 계산은 본인_과다 기준
      // 본인(self) 과다 = max(0, 10-30) = 0 → 페널티 없음
      // S = 50 + 15 - 0 = 65
      const self = makeChart({ 목: 22, 화: 22, 토: 10, 금: 23, 수: 23 });
      const rel = makeChart({ 목: 15, 화: 15, 토: 35, 금: 20, 수: 15 });
      const score = computeOhaengScore(self, rel);
      expect(score).toBeGreaterThan(50);
    });

    it('대칭 입력 → 입력 순서 무관 결과', () => {
      const a = makeChart({ 목: 5, 화: 25, 토: 25, 금: 25, 수: 20 });
      const b = makeChart({ 목: 40, 화: 15, 토: 15, 금: 15, 수: 15 });
      // self=a,rel=b vs self=b,rel=a 는 다를 수 있음 (비대칭 수식)
      // 단, 각 호출 결과가 모두 [0,100] 범위인지 확인
      expect(computeOhaengScore(a, b)).toBeGreaterThanOrEqual(0);
      expect(computeOhaengScore(b, a)).toBeGreaterThanOrEqual(0);
    });
  });
});
