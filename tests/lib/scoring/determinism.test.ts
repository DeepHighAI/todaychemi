import { describe, it, expect } from 'vitest';
import { computeScore } from '@/lib/scoring';
import type { ChartCore } from '@/types/chart';

const SELF: ChartCore = {
  year_pillar: '甲寅',
  month_pillar: '乙卯',
  day_pillar: '丙午',
  hour_pillar: '丁亥',
  day_master_element: '화',
  five_elements_counts: { 목: 3, 화: 3, 토: 1, 금: 0, 수: 1 },
  gender_normalized: 'M',
};

const RELATION: ChartCore = {
  year_pillar: '戊申',
  month_pillar: '己酉',
  day_pillar: '庚戌',
  hour_pillar: '辛丑',
  day_master_element: '금',
  five_elements_counts: { 목: 0, 화: 0, 토: 3, 금: 4, 수: 1 },
  gender_normalized: 'F',
};

describe('computeScore — §8.2 결정성', () => {
  it('score: 1000회 동일 결과 (unique set size === 1)', () => {
    const scores = Array.from({ length: 1000 }, () =>
      computeScore({ self: SELF, relation: RELATION, mode: '썸합' }).score,
    );
    expect(new Set(scores).size).toBe(1);
  });

  it('hap_chung_hyung_hae: 1000회 동일 결과', () => {
    const values = Array.from({ length: 1000 }, () =>
      computeScore({ self: SELF, relation: RELATION, mode: '썸합' }).components
        .hap_chung_hyung_hae,
    );
    expect(new Set(values).size).toBe(1);
  });

  it('sipsin: 1000회 동일 결과', () => {
    const values = Array.from({ length: 1000 }, () =>
      computeScore({ self: SELF, relation: RELATION, mode: '썸합' }).components
        .sipsin,
    );
    expect(new Set(values).size).toBe(1);
  });

  it('ohaeng: 1000회 동일 결과', () => {
    const values = Array.from({ length: 1000 }, () =>
      computeScore({ self: SELF, relation: RELATION, mode: '썸합' }).components
        .ohaeng,
    );
    expect(new Set(values).size).toBe(1);
  });
});
