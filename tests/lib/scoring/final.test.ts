import { describe, it, expect } from 'vitest';
import { computeScore } from '@/lib/scoring';
import type { ChartCore } from '@/types/chart';
import type { ScoringOutput } from '@/types/scoring';

type ElementCounts = Record<'목' | '화' | '토' | '금' | '수', number>;

function makeChart(
  year: string,
  month: string,
  day: string,
  hour: string | null = null,
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
  };
}

describe('computeScore (§1 + §7)', () => {
  describe('반환값 구조', () => {
    it('ScoringOutput 형태 반환', () => {
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const rel = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      const out: ScoringOutput = computeScore({ self, relation: rel, mode: '일합' });

      expect(typeof out.score).toBe('number');
      expect(typeof out.components.hap_chung_hyung_hae).toBe('number');
      expect(typeof out.components.sipsin).toBe('number');
      expect(typeof out.components.ohaeng).toBe('number');
      expect(typeof out.mode_adjustment).toBe('number');
      expect(typeof out.scoring_version).toBe('number');
    });

    it('scoring_version 기본값 = 1 (D-1)', () => {
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const rel = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      const out = computeScore({ self, relation: rel, mode: '일합' });
      expect(out.scoring_version).toBe(1);
    });

    it('scoring_version override 가능', () => {
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const rel = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      const out = computeScore({ self, relation: rel, mode: '일합', scoring_version: 2 });
      expect(out.scoring_version).toBe(2);
    });
  });

  describe('§7 점수 클램프 + 정수 반올림', () => {
    it('score는 [0, 100] 정수', () => {
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const rel = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      const out = computeScore({ self, relation: rel, mode: '친구합' });
      expect(Number.isInteger(out.score)).toBe(true);
      expect(out.score).toBeGreaterThanOrEqual(0);
      expect(out.score).toBeLessThanOrEqual(100);
    });

    it('component scores는 [0, 100] 범위', () => {
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const rel = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      const out = computeScore({ self, relation: rel, mode: '돈합' });
      const c = out.components;
      for (const v of [c.hap_chung_hyung_hae, c.sipsin, c.ohaeng]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('§1 가중 합산 공식', () => {
    it('6모드 모두 [0,100] 점수 반환', () => {
      const modes = ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'] as const;
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const rel = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      for (const m of modes) {
        const out = computeScore({ self, relation: rel, mode: m });
        expect(out.score).toBeGreaterThanOrEqual(0);
        expect(out.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('시나리오 추정 필드', () => {
    it('rel 시주 있음 → scenario_estimate=null', () => {
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const rel = makeChart('乙丑', '乙丑', '乙丑', '乙丑');
      const out = computeScore({ self, relation: rel, mode: '일합' });
      expect(out.scenario_estimate).toBeNull();
    });

    it('rel 시주 없음 → scenario_estimate 객체 반환', () => {
      const self = makeChart('甲子', '甲子', '甲子', '甲子');
      const relNoHour = makeChart('乙丑', '乙丑', '乙丑', null);
      const out = computeScore({ self, relation: relNoHour, mode: '일합' });
      expect(out.scenario_estimate).not.toBeNull();
      expect(out.scenario_estimate!.is_estimated).toBe(true);
      expect(typeof out.scenario_estimate!.display_score).toBe('number');
      expect(typeof out.scenario_estimate!.display_range).toBe('number');
      expect(typeof out.scenario_estimate!.needs_badge).toBe('boolean');
    });
  });

  describe('결정성 (기초 확인 — 상세는 determinism.test.ts)', () => {
    it('동일 입력 → 동일 출력 (3회 확인)', () => {
      const self = makeChart('甲寅', '乙卯', '丙午', '丁亥');
      const rel = makeChart('戊申', '己酉', '庚戌', '辛丑');
      const r1 = computeScore({ self, relation: rel, mode: '썸합' });
      const r2 = computeScore({ self, relation: rel, mode: '썸합' });
      const r3 = computeScore({ self, relation: rel, mode: '썸합' });
      expect(r1.score).toBe(r2.score);
      expect(r2.score).toBe(r3.score);
    });
  });
});
