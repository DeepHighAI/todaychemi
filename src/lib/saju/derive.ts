// deriveSaju — 4기둥 → SajuDerived 파생층 오케스트레이터 (P1, derived_version 1).
// 순수 결정형(ADR-035): Date.now/Math.random/LLM 개입 0건, gender 불요.
// null 월주/시주 graceful: 해당 슬롯 null + hour_known 플래그로 표기.
// ⚠️ 기둥 변형(합성 차트 등) 시 derived 재계산 의무 — 이 함수를 다시 호출하지 않은
//    stale derived 를 그대로 옮겨 붙이면 안 된다 (docs/specs/manseryeok_theory.md).

import type { SajuDerived, PillarSipsin, JijangganHidden } from '@/types/chart';

import {
  splitPillar,
  normalizeGanji,
  gapjaIndex,
  gapjaKo,
  STEM_INFO,
  BRANCH_INFO,
  type Stem,
  type Branch,
  type Element5,
} from './ganji';
import { JIJANGGAN, JIJANGGAN_WEIGHTS } from './jijanggan';
import { sipsinOf, sipsinOfBranch, type SipsinName } from './sipsin';
import { computeSinkang } from './sinkang';
import { computeYongsin } from './yongsin';

export interface DeriveSajuPillars {
  year_pillar: string;
  month_pillar: string | null;
  day_pillar: string;
  hour_pillar: string | null;
}

// 파생 알고리즘 버전 — 산식 변경 시 범프 (theory_profile_version과 함께 관리)
const DERIVED_VERSION = 1;

// 천간 1글자 가중치 — 지장간 정기(10)와 동일 정수 스케일 (부동소수 금지, ADR-035)
const STEM_WEIGHT = 10;

interface PillarSplit {
  stem: Stem;
  branch: Branch;
}

// 지장간 엔트리 → 직렬화 가능한 JijangganHidden 복사 (테이블 참조 공유 방지)
function hiddenOf(branch: Branch): JijangganHidden {
  const entry = JIJANGGAN[branch];
  return { 여기: entry.여기, 중기: entry.중기, 정기: entry.정기 };
}

export function deriveSaju(pillars: DeriveSajuPillars): SajuDerived {
  // 한글 독음 기둥 방어 정규화 (한자 입력은 passthrough)
  const yearPillar = normalizeGanji(pillars.year_pillar);
  const monthPillar = pillars.month_pillar !== null ? normalizeGanji(pillars.month_pillar) : null;
  const dayPillar = normalizeGanji(pillars.day_pillar);
  const hourPillar = pillars.hour_pillar !== null ? normalizeGanji(pillars.hour_pillar) : null;

  const year = splitPillar(yearPillar);
  const month = monthPillar !== null ? splitPillar(monthPillar) : null;
  const day = splitPillar(dayPillar);
  const hour = hourPillar !== null ? splitPillar(hourPillar) : null;
  const dayStem = day.stem;
  const presentSplits = [year, month, day, hour].filter((s): s is PillarSplit => s !== null);

  // §3.1 십신 — 지지는 지장간 정기 기준, day 슬롯 stem은 '일간'
  const sipsinSlot = (split: PillarSplit, isDay: boolean): PillarSipsin => ({
    stem: isDay ? '일간' : sipsinOf(dayStem, split.stem),
    branch: sipsinOfBranch(dayStem, split.branch),
  });
  const sipsinYear = sipsinSlot(year, false);
  const sipsinMonth = month !== null ? sipsinSlot(month, false) : null;
  const sipsinDay = sipsinSlot(day, true);
  const sipsinHour = hour !== null ? sipsinSlot(hour, false) : null;

  // counts: 10키 전부 0 초기화 후 '일간' 슬롯 제외 집계
  const counts: Record<SipsinName, number> = {
    비견: 0,
    겁재: 0,
    식신: 0,
    상관: 0,
    편재: 0,
    정재: 0,
    편관: 0,
    정관: 0,
    편인: 0,
    정인: 0,
  };
  for (const slot of [sipsinYear, sipsinMonth, sipsinDay, sipsinHour]) {
    if (slot === null) continue;
    if (slot.stem !== '일간') counts[slot.stem] += 1;
    counts[slot.branch] += 1;
  }

  // §3.2 weighted 지장간 오행 프로필 — 전 항 양수 가산이라 -0 발생 불가 (sinkang.ts 참조)
  const ohaengWeighted: Record<Element5, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const split of presentSplits) {
    ohaengWeighted[STEM_INFO[split.stem].element] += STEM_WEIGHT;
    const entry = JIJANGGAN[split.branch];
    ohaengWeighted[STEM_INFO[entry.정기].element] += JIJANGGAN_WEIGHTS.정기;
    if (entry.중기 !== null) ohaengWeighted[STEM_INFO[entry.중기].element] += JIJANGGAN_WEIGHTS.중기;
    if (entry.여기 !== null) ohaengWeighted[STEM_INFO[entry.여기].element] += JIJANGGAN_WEIGHTS.여기;
  }

  // §3.3 신강약 + §3.4 용신·희신
  const sinkang = computeSinkang({
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
  });
  const yongsin = computeYongsin(dayStem, sinkang.level, ohaengWeighted);

  // §3.5 음양 밸런스 — 표면 글자(8 또는 6), 지지 음양 = 체(體) 기준
  let yang = 0;
  let yin = 0;
  for (const split of presentSplits) {
    if (STEM_INFO[split.stem].yinyang === '양') yang += 1;
    else yin += 1;
    if (BRANCH_INFO[split.branch].yinyang === '양') yang += 1;
    else yin += 1;
  }

  return {
    derived_version: DERIVED_VERSION,
    hour_known: hourPillar !== null,
    sipsin: { year: sipsinYear, month: sipsinMonth, day: sipsinDay, hour: sipsinHour, counts },
    jijanggan: {
      year: hiddenOf(year.branch),
      month: month !== null ? hiddenOf(month.branch) : null,
      day: hiddenOf(day.branch),
      hour: hour !== null ? hiddenOf(hour.branch) : null,
    },
    ohaeng_weighted: ohaengWeighted,
    sinkang,
    yongsin,
    yinyang_balance: { yang, yin },
    // 띠 — 년지 기준 한글 독음 (year_pillar 자체가 절기·입춘 기준)
    tti: { branch: BRANCH_INFO[year.branch].ko, animal_ko: BRANCH_INFO[year.branch].animal_ko },
    ilju: { pillar: dayPillar, gapja_index: gapjaIndex(dayPillar), ko: gapjaKo(dayPillar) },
  };
}
