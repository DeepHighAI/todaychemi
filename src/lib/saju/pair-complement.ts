// pair-complement — 두 사람 "공통 보완 원소" (energy_food 결정형 입력, ADR-040).
// 순수 결정형(ADR-035): Date.now/Math.random/LLM 0건. 두 ohaeng_weighted 분포를 합산해
// 가장 약한(둘 다 부족한) 원소를 고른다 — yongsin.ts 중화 분기(:65-75)의 최소-원소 룰 미러.
// 동률 tie-break: 목화토금수 고정 순서. yongsin 겹침 2차 tie-break 은 명리 검수로 연기(잠정).

import { deriveSaju, type DeriveSajuPillars } from './derive';
import { type Element5 } from './ganji';

import type { ChartCore, SajuDerived } from '@/types/chart';

// 중화 동률 tie-break 고정 순서 (yongsin.ts:26 와 동일)
const ELEMENT_ORDER: readonly Element5[] = ['목', '화', '토', '금', '수'];

export interface PairComplementResult {
  // 두 사람이 함께 보완하면 좋은 원소 (합산 최소)
  element: Element5;
  // 합산 분포 — 근거 표시·디버그용
  combined: Record<Element5, number>;
}

// 순수 함수: 두 오행 분포 → 합산 최소 원소. 1000회 결정성 보장(고정 순회).
export function computePairComplement(
  selfWeighted: Record<Element5, number>,
  relationWeighted: Record<Element5, number>,
): PairComplementResult {
  const combined = {} as Record<Element5, number>;
  for (const element of ELEMENT_ORDER) {
    combined[element] = selfWeighted[element] + relationWeighted[element];
  }
  let element = ELEMENT_ORDER[0];
  for (const candidate of ELEMENT_ORDER) {
    if (combined[candidate] < combined[element]) element = candidate;
  }
  return { element, combined };
}

// derived fail-open: ohaeng_weighted 를 얻을 수 있으면(derived 또는 deriveSaju self-heal) 반환,
// 둘 다 실패하면 null. (payload.ts resolveDerivedForLlm 패턴)
function weightedOrNull(
  chart: ChartCore,
  deriveFn: (pillars: DeriveSajuPillars) => SajuDerived,
): Record<Element5, number> | null {
  if (chart.derived?.ohaeng_weighted) return chart.derived.ohaeng_weighted;
  try {
    return deriveFn({
      year_pillar: chart.year_pillar,
      month_pillar: chart.month_pillar,
      day_pillar: chart.day_pillar,
      hour_pillar: chart.hour_pillar,
    }).ohaeng_weighted;
  } catch {
    return null;
  }
}

// 단일 차트의 오행 분포 해소 — derived → deriveSaju → five_elements_counts(항상 존재) 폴백.
export function resolveOhaengWeighted(
  chart: ChartCore,
  deriveFn: (pillars: DeriveSajuPillars) => SajuDerived = deriveSaju,
): Record<Element5, number> {
  return weightedOrNull(chart, deriveFn) ?? chart.five_elements_counts;
}

// 차트 쌍 → 공통 보완 원소. 스케일 혼용 금지: 한쪽이라도 weighted 해소 실패 시
// 양쪽을 표면 카운트(five_elements_counts)로 통일해 계산한다.
export function pairComplementForCharts(
  self: ChartCore,
  relation: ChartCore,
  deriveFn: (pillars: DeriveSajuPillars) => SajuDerived = deriveSaju,
): PairComplementResult {
  const selfWeighted = weightedOrNull(self, deriveFn);
  const relationWeighted = weightedOrNull(relation, deriveFn);
  if (selfWeighted && relationWeighted) {
    return computePairComplement(selfWeighted, relationWeighted);
  }
  return computePairComplement(self.five_elements_counts, relation.five_elements_counts);
}
