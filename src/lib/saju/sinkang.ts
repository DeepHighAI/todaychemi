// 신강약(身强弱) — 억부 단순 점수제. 결정형(ADR-035): 정수 연산만, LLM 개입 0.
// 산식·가중치는 전문가 검토 전 잠정 (docs/specs/manseryeok_theory.md 명기 대상).

import {
  splitPillar,
  STEM_INFO,
  BRANCH_INFO,
  GENERATED_BY,
  CONTROLLED_BY,
  type Element5,
} from './ganji';
import { stage12, type Stage12 } from './unseong';

export type SinkangLevel = '신강' | '중화' | '신약';

export interface SinkangDetail {
  base: 50;
  deukryeong: 0 | 20;
  own_term: number;
  support_term: number;
  pressure_term: number;
  unseong_term: -15 | 0 | 15;
  month_unseong: Stage12 | null;
}

export interface SinkangResult {
  level: SinkangLevel;
  score: number;
  detail: SinkangDetail;
}

export interface SinkangPillars {
  year: string;
  month: string | null;
  day: string;
  hour: string | null;
}

const BASE_SCORE = 50;
const DEUKRYEONG_BONUS = 20; // 득령: 월지 오행 == 일간 오행
const OWN_WEIGHT = 10; // 일간과 같은 오행 글자당
const SUPPORT_WEIGHT = 8; // 일간을 생하는 오행 글자당
const PRESSURE_WEIGHT = 8; // 일간을 극하는 오행 글자당 (감점)
const UNSEONG_BONUS = 15; // 월지 운성 건록·제왕
const UNSEONG_PENALTY = -15; // 월지 운성 사·절·묘
const STRONG_THRESHOLD = 70; // score >= 70 → 신강
const WEAK_THRESHOLD = 30; // score <= 30 → 신약

const PROSPEROUS_STAGES: readonly Stage12[] = ['건록', '제왕'];
const DECLINING_STAGES: readonly Stage12[] = ['사', '절', '묘'];

// 4기둥(시·월 null 허용) 표면 글자 기반 신강약 점수.
// 시간 미상이면 6글자 집계로 점수 천장이 낮아짐 — 임계값은 동일 적용 (spec 명문화).
export function computeSinkang(pillars: SinkangPillars): SinkangResult {
  const day = splitPillar(pillars.day);
  const dayEl = STEM_INFO[day.stem].element;

  // 표면 글자 오행 카운트 (천간 + 지지, null 기둥 스킵)
  const surface: Record<Element5, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const presentPillars = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(
    (p): p is string => p !== null,
  );
  for (const pillar of presentPillars) {
    const { stem, branch } = splitPillar(pillar);
    surface[STEM_INFO[stem].element] += 1;
    surface[BRANCH_INFO[branch].element] += 1;
  }

  const month = pillars.month !== null ? splitPillar(pillars.month) : null;

  const deukryeong: 0 | 20 =
    month !== null && BRANCH_INFO[month.branch].element === dayEl ? DEUKRYEONG_BONUS : 0;

  const ownTerm = OWN_WEIGHT * surface[dayEl];
  const supportTerm = SUPPORT_WEIGHT * surface[GENERATED_BY[dayEl]];
  // 극 오행 0건이면 -0이 되지 않도록 명시 분기 (deep-equal·직렬화 결정성)
  const pressureCount = surface[CONTROLLED_BY[dayEl]];
  const pressureTerm = pressureCount === 0 ? 0 : -PRESSURE_WEIGHT * pressureCount;

  let unseongTerm: -15 | 0 | 15 = 0;
  let monthUnseong: Stage12 | null = null;
  if (month !== null) {
    monthUnseong = stage12(day.stem, month.branch);
    if (PROSPEROUS_STAGES.includes(monthUnseong)) {
      unseongTerm = UNSEONG_BONUS;
    } else if (DECLINING_STAGES.includes(monthUnseong)) {
      unseongTerm = UNSEONG_PENALTY;
    }
  }

  const score = BASE_SCORE + deukryeong + ownTerm + supportTerm + pressureTerm + unseongTerm;
  const level: SinkangLevel =
    score >= STRONG_THRESHOLD ? '신강' : score <= WEAK_THRESHOLD ? '신약' : '중화';

  return {
    level,
    score,
    detail: {
      base: BASE_SCORE,
      deukryeong,
      own_term: ownTerm,
      support_term: supportTerm,
      pressure_term: pressureTerm,
      unseong_term: unseongTerm,
      month_unseong: monthUnseong,
    },
  };
}
