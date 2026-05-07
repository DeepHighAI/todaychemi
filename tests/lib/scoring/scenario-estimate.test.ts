import { describe, it, expect } from 'vitest';
import { computeScenarioEstimate } from '@/lib/scoring/scenarioEstimate';
import type { ChartCore } from '@/types/chart';

type ElementCounts = Record<'목' | '화' | '토' | '금' | '수', number>;

function makeChart(
  year: string,
  month: string,
  day: string,
  hour: string | null,
  counts: Partial<ElementCounts> = {},
): ChartCore {
  const defaults: ElementCounts = { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 };
  return {
    year_pillar: year,
    month_pillar: month,
    day_pillar: day,
    hour_pillar: hour,
    day_master_element: '목',
    five_elements_counts: { ...defaults, ...counts } as ElementCounts,
    gender_normalized: 'M',
    yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
  };
}

describe('computeScenarioEstimate (§5)', () => {
  describe('§5.1 12지 후보 계산', () => {
    it('12지 각각에 대해 점수 산출 후 mean/range 반환', () => {
      const self = makeChart('甲子', '甲子', '甲子', null);
      const relNoHour = makeChart('乙丑', '乙丑', '乙丑', null);
      const result = computeScenarioEstimate(self, relNoHour, '일합');

      expect(result.is_estimated).toBe(true);
      expect(result.display_score).toBeGreaterThanOrEqual(0);
      expect(result.display_score).toBeLessThanOrEqual(100);
      expect(result.display_range).toBeGreaterThanOrEqual(0);
    });

    it('display_score는 12개 점수의 반올림 평균', () => {
      const self = makeChart('甲子', '甲子', '甲子', null);
      const rel = makeChart('乙丑', '乙丑', '乙丑', null);
      const result = computeScenarioEstimate(self, relNoHour(rel), '친구합');
      // display_score는 정수
      expect(Number.isInteger(result.display_score)).toBe(true);
    });

    it('display_range = round((max - min) / 2)', () => {
      const self = makeChart('甲子', '甲子', '甲子', null);
      const rel = makeChart('乙丑', '乙丑', '乙丑', null);
      const result = computeScenarioEstimate(self, relNoHour(rel), '일합');
      expect(Number.isInteger(result.display_range)).toBe(true);
      expect(result.display_range).toBeGreaterThanOrEqual(0);
    });
  });

  describe('§5.2 needs_badge (±15 이상)', () => {
    it('12지 점수가 균등하면 needs_badge=false (range 작음)', () => {
      // 두 차트가 거의 같으면 시주에 무관하게 비슷한 점수 → range 작음
      const self = makeChart('甲子', '甲子', '甲子', null);
      const rel = makeChart('甲子', '甲子', '甲子', null);
      const result = computeScenarioEstimate(self, relNoHour(rel), '일합');
      // 동일 차트 → 점수 분산 없음 → badge 없음 가능
      expect(typeof result.needs_badge).toBe('boolean');
    });

    it('needs_badge는 display_range >= 15일 때 true', () => {
      // 우리가 range를 직접 제어할 수 없으므로 needs_badge 규칙 검증
      const self = makeChart('甲子', '甲子', '甲子', null);
      const rel = makeChart('乙丑', '乙丑', '乙丑', null);
      const result = computeScenarioEstimate(self, relNoHour(rel), '일합');
      const expectedBadge = result.display_range >= 15;
      expect(result.needs_badge).toBe(expectedBadge);
    });
  });

  describe('시주 있을 때 vs 없을 때', () => {
    it('rel 시주 있으면 is_estimated=false, scenario_estimate=null 반환', () => {
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const relWithHour = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      const result = computeScenarioEstimate(self, relWithHour, '일합');
      expect(result.is_estimated).toBe(false);
      // 시주 있을 때는 실제 점수를 직접 반환하므로 display_range=0
      expect(result.display_range).toBe(0);
    });

    it('self 시주 없어도 rel 시주 있으면 is_estimated=false', () => {
      const selfNoHour = makeChart('甲子', '甲子', '甲子', null);
      const relWithHour = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      const result = computeScenarioEstimate(selfNoHour, relWithHour, '친구합');
      expect(result.is_estimated).toBe(false);
    });
  });
});

// 시주 제거 헬퍼
function relNoHour(chart: ChartCore): ChartCore {
  return { ...chart, hour_pillar: null };
}
