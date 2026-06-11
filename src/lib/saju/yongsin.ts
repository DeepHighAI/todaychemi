// 용신(用神)·희신(喜神) — 억부 1차 룰 (오행 레벨, 천간 픽 아님).
// ssaju M/K 룩업은 미러하지 않음: K 함수가 strength 역전 구조라 신뢰 불가 (설계 §1).
// 전 규칙은 전문가 검토 전 잠정 — docs/specs/manseryeok_theory.md 명기 대상.

import {
  STEM_INFO,
  GENERATES,
  CONTROLS,
  GENERATED_BY,
  CONTROLLED_BY,
  type Stem,
  type Element5,
} from './ganji';
import type { SinkangLevel } from './sinkang';

export type YongsinBasis = '억부신강' | '억부신약' | '중화보완';

export interface YongsinResult {
  basis: YongsinBasis;
  primary: Element5;
  secondary: Element5[];
  huisin: Element5;
}

// 중화 동률 tie-break 고정 순서
const ELEMENT_ORDER: readonly Element5[] = ['목', '화', '토', '금', '수'];

export function computeYongsin(
  dayStem: Stem,
  level: SinkangLevel,
  weighted: Record<Element5, number>,
): YongsinResult {
  const dayEl = STEM_INFO[dayStem].element;
  const inseong = GENERATED_BY[dayEl]; // 인성: 일간을 생하는 오행
  const bigyeop = dayEl; // 비겁: 일간과 같은 오행
  const siksang = GENERATES[dayEl]; // 식상: 일간이 생하는 오행
  const jaeseong = CONTROLS[dayEl]; // 재성: 일간이 극하는 오행
  const gwanseong = CONTROLLED_BY[dayEl]; // 관성: 일간을 극하는 오행

  if (level === '신약') {
    // 생조 우선 고정: 인성 1순위, 비겁 보조
    return {
      basis: '억부신약',
      primary: inseong,
      secondary: [bigyeop],
      huisin: GENERATED_BY[inseong],
    };
  }

  if (level === '신강') {
    // 설기·제어 후보 — 동률 시 고정 우선순위 관성 > 식상 > 재성 (배열 순서가 우선순위)
    const candidates: readonly Element5[] = [gwanseong, siksang, jaeseong];
    let primary = candidates[0];
    for (const candidate of candidates) {
      if (weighted[candidate] > weighted[primary]) primary = candidate;
    }
    return {
      basis: '억부신강',
      primary,
      secondary: candidates.filter((c) => c !== primary),
      huisin: GENERATED_BY[primary],
    };
  }

  // 중화: 가장 부족한 오행 보완 (동률 시 목화토금수 순)
  let primary = ELEMENT_ORDER[0];
  for (const element of ELEMENT_ORDER) {
    if (weighted[element] < weighted[primary]) primary = element;
  }
  return {
    basis: '중화보완',
    primary,
    secondary: [],
    huisin: GENERATED_BY[primary],
  };
}
