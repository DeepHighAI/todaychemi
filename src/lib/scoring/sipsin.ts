import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import { STEM_ELEMENT } from '@/lib/kasi/constants';
import { SIPSIN_AXIS, type SipsinAxes } from '@/lib/scoring/constants';

export type Sipsin =
  | '비견' | '겁재'
  | '식신' | '상관'
  | '정재' | '편재'
  | '정관' | '편관'
  | '정인' | '편인';

// 음양: 甲丙戊庚壬 = 양(false), 乙丁己辛癸 = 음(true)
const YIN_STEMS = new Set(['乙', '丁', '己', '辛', '癸']);

function isYin(stem: string): boolean {
  return YIN_STEMS.has(stem);
}

type Element = '목' | '화' | '토' | '금' | '수';

// 상생 관계: 'A生B' — A generates B
const GENERATES: Record<Element, Element> = {
  '목': '화', '화': '토', '토': '금', '금': '수', '수': '목',
};

// 상극 관계: 'A克B' — A controls B
const CONTROLS: Record<Element, Element> = {
  '목': '토', '토': '수', '수': '화', '화': '금', '금': '목',
};

// §3 십신 산출 — 본인 일간 기준 대상 천간의 십신
export function computeSipsin(selfDayStem: string, targetStem: string): Sipsin {
  const selfEl = STEM_ELEMENT[selfDayStem] as Element;
  const targetEl = STEM_ELEMENT[targetStem] as Element;
  const sameYin = isYin(selfDayStem) === isYin(targetStem);

  if (selfEl === targetEl) {
    return sameYin ? '비견' : '겁재';
  }
  if (GENERATES[selfEl] === targetEl) {
    return sameYin ? '식신' : '상관';
  }
  if (CONTROLS[selfEl] === targetEl) {
    return sameYin ? '편재' : '정재';
  }
  if (CONTROLS[targetEl] === selfEl) {
    return sameYin ? '편관' : '정관';
  }
  // targetEl generates selfEl
  return sameYin ? '편인' : '정인';
}

// §3.1 모드별 십신 축 매핑
export const MODE_SIPSIN_AXIS: Record<Mode, keyof SipsinAxes> = {
  '일합':   'authority',
  '친구합': 'emotion',
  '돈합':   'assets',
  '첫합':   'emotion',
  '썸합':   'emotion',
  '오래합': 'emotion',
};

// §3.2 십신 점수 정규화
// S_sipsin = clamp( ((mode_axis_score + 30) / 60) * 100, 0, 100 )
export function computeSipsinScore(
  selfDayStem: string,
  relation: ChartCore,
  mode: Mode,
): number {
  const axis = MODE_SIPSIN_AXIS[mode];
  const stems = [
    relation.year_pillar[0],
    relation.month_pillar?.[0] ?? null,
    relation.day_pillar[0],
    relation.hour_pillar?.[0] ?? null,
  ].filter((s): s is string => s !== null);

  let sum = 0;
  for (const stem of stems) {
    const sipsin = computeSipsin(selfDayStem, stem);
    sum += SIPSIN_AXIS[sipsin][axis];
  }

  return Math.max(0, Math.min(100, ((sum + 30) / 60) * 100));
}
