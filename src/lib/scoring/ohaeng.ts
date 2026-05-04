import type { ChartCore } from '@/types/chart';

type Element = '목' | '화' | '토' | '금' | '수';
const ELEMENTS: Element[] = ['목', '화', '토', '금', '수'];

// §4.1 보완 보너스 / 과다 중첩 페널티 + §4.2 정규화
export function computeOhaengScore(self: ChartCore, relation: ChartCore): number {
  const selfCounts = self.five_elements_counts;
  const relCounts = relation.five_elements_counts;

  // 전체 합 기준 비율(%)로 변환
  const selfTotal = Object.values(selfCounts).reduce((a, b) => a + b, 0) || 1;
  const relTotal = Object.values(relCounts).reduce((a, b) => a + b, 0) || 1;

  let bonus = 0;
  let penalty = 0;

  for (const el of ELEMENTS) {
    const selfPct = (selfCounts[el] / selfTotal) * 100;
    const relPct = (relCounts[el] / relTotal) * 100;

    // 보완 보너스: self 부족 기준
    const selfLack = Math.max(0, 20 - selfPct);
    const relComplement = Math.min(relPct, selfLack);
    bonus += relComplement * 1.5;

    // 과다 중첩 페널티: self 과다 기준
    const selfExcess = Math.max(0, selfPct - 30);
    const relOverlap = Math.min(relPct, selfExcess);
    penalty += relOverlap * 1.0;
  }

  // §4.2 정규화: S = clamp(50 + bonus - penalty, 0, 100)
  return Math.max(0, Math.min(100, 50 + bonus - penalty));
}
