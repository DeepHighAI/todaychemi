import { describe, expect, it } from 'vitest';

import { deriveSaju } from '@/lib/saju/derive';
import type { Element5 } from '@/lib/saju/ganji';
import {
  computePairComplement,
  pairComplementForCharts,
  resolveOhaengWeighted,
} from '@/lib/saju/pair-complement';
import type { ChartCore, SajuDerived } from '@/types/chart';

import { mockChartCoreSelf, mockChartCoreRelation } from '../../fixtures/hapcard';

const ALL: readonly Element5[] = ['목', '화', '토', '금', '수'];

function elementMap(partial: Partial<Record<Element5, number>>): Record<Element5, number> {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0, ...partial };
}

describe('computePairComplement — 두 사람 공통 보완 원소', () => {
  it('두 분포를 합산해 가장 약한 원소를 고른다', () => {
    const self = elementMap({ 목: 1, 화: 5, 토: 5, 금: 5, 수: 5 });
    const relation = elementMap({ 목: 1, 화: 5, 토: 5, 금: 5, 수: 5 });
    const result = computePairComplement(self, relation);
    expect(result.element).toBe('목');
    expect(result.combined).toEqual(elementMap({ 목: 2, 화: 10, 토: 10, 금: 10, 수: 10 }));
  });

  it('목이 아닌 단독 최소 원소도 정확히 고른다', () => {
    const self = elementMap({ 목: 5, 화: 1, 토: 5, 금: 5, 수: 5 });
    const relation = elementMap({ 목: 5, 화: 1, 토: 5, 금: 5, 수: 5 });
    expect(computePairComplement(self, relation).element).toBe('화');
  });

  it('동률 시 목화토금수 순으로 가장 앞 원소를 고른다', () => {
    // 토·금 합산 동률 최소(2) — 앞 순서인 토를 골라야 한다
    const self = elementMap({ 목: 5, 화: 5, 토: 1, 금: 1, 수: 5 });
    const relation = elementMap({ 목: 5, 화: 5, 토: 1, 금: 1, 수: 5 });
    expect(computePairComplement(self, relation).element).toBe('토');
  });

  it('1000회 동일 입력 → 동일 출력 (ADR-040 결정성)', () => {
    const self = elementMap({ 목: 2, 화: 7, 토: 3, 금: 9, 수: 4 });
    const relation = elementMap({ 목: 6, 화: 1, 토: 8, 금: 2, 수: 5 });
    const results = Array.from(
      { length: 1000 },
      () => computePairComplement(self, relation).element,
    );
    expect(new Set(results).size).toBe(1);
  });
});

describe('resolveOhaengWeighted — derived fail-open 해소', () => {
  it('derived.ohaeng_weighted 가 있으면 그대로 사용한다', () => {
    const weighted = elementMap({ 목: 9, 화: 8, 토: 7, 금: 6, 수: 5 });
    const chart: ChartCore = {
      ...mockChartCoreSelf,
      derived: { ohaeng_weighted: weighted } as SajuDerived,
    };
    expect(resolveOhaengWeighted(chart)).toEqual(weighted);
  });

  it('derived 부재 시 deriveSaju 로 자가 계산한다 (self-heal)', () => {
    const expected = deriveSaju({
      year_pillar: mockChartCoreSelf.year_pillar,
      month_pillar: mockChartCoreSelf.month_pillar,
      day_pillar: mockChartCoreSelf.day_pillar,
      hour_pillar: mockChartCoreSelf.hour_pillar,
    }).ohaeng_weighted;
    expect(resolveOhaengWeighted(mockChartCoreSelf)).toEqual(expected);
  });

  it('deriveSaju 실패 시 five_elements_counts 로 폴백한다', () => {
    const result = resolveOhaengWeighted(mockChartCoreSelf, () => {
      throw new Error('derive failed');
    });
    expect(result).toEqual(mockChartCoreSelf.five_elements_counts);
  });
});

describe('pairComplementForCharts — 차트 쌍 → 보완 원소', () => {
  it('유효한 Element5 를 결정형으로 반환한다', () => {
    const results = Array.from(
      { length: 1000 },
      () => pairComplementForCharts(mockChartCoreSelf, mockChartCoreRelation).element,
    );
    expect(new Set(results).size).toBe(1);
    expect(ALL).toContain(results[0]);
  });

  it('한쪽이라도 weighted 해소 실패 시 양쪽 표면 카운트로 통일한다 (스케일 혼용 금지)', () => {
    // self 만 throw → 양쪽 five_elements_counts 합산으로 계산되어야 한다
    let calls = 0;
    const flakyDerive = () => {
      calls += 1;
      throw new Error('derive failed');
    };
    const expected = computePairComplement(
      mockChartCoreSelf.five_elements_counts,
      mockChartCoreRelation.five_elements_counts,
    );
    const result = pairComplementForCharts(mockChartCoreSelf, mockChartCoreRelation, flakyDerive);
    expect(result.element).toBe(expected.element);
    expect(result.combined).toEqual(expected.combined);
    expect(calls).toBeGreaterThan(0);
  });
});
