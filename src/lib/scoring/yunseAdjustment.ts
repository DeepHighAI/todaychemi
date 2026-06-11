import type { YunseCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import { HEAVENLY_STEMS, EARTHLY_BRANCHES } from '@/lib/kasi/constants';
import { normalizeGanji } from '@/lib/saju/ganji';
import { STEM_HAP, BRANCH_HAP, CHUNG } from '@/lib/scoring/constants';

// SCORING_VERSION 2 (2026-06-11): 프로덕션 ganji 는 한자다 —
// ssaju yunse(대운/세운/월운/일운)와 KASI relation.day_pillar 모두 한자('庚辰' 등).
// v1 은 한글 배열 indexOf 매칭이라 프로덕션에서 합·충 검출이 항상 실패해 보정이 0 이었다.
// 변환은 saju/ganji.normalizeGanji 사용 — 위치 기반 글자별 해석이라 한글/한자/혼합('庚진')
// 모두 한자로 정규화되고, 해석 불가 입력은 원본 통과 후 테이블 미스(보정 0)로 강등된다.

// 정규화 키 (작은 인덱스 먼저) — constants 한자 테이블과 동일 규칙 (today.ts 미러)
function stemKey(a: string, b: string): string {
  const ia = HEAVENLY_STEMS.indexOf(a as (typeof HEAVENLY_STEMS)[number]);
  const ib = HEAVENLY_STEMS.indexOf(b as (typeof HEAVENLY_STEMS)[number]);
  return ia <= ib ? a + b : b + a;
}

function branchKey(a: string, b: string): string {
  const ia = EARTHLY_BRANCHES.indexOf(a as (typeof EARTHLY_BRANCHES)[number]);
  const ib = EARTHLY_BRANCHES.indexOf(b as (typeof EARTHLY_BRANCHES)[number]);
  return ia <= ib ? a + b : b + a;
}

// 4-layer 가중치 (사용자 §1.1 승인 2026-05-07)
const LAYER_WEIGHTS = {
  daeun: 0.40,
  seyun: 0.30,
  wolun: 0.20,
  iliun: 0.10,
} as const;

// 모드별 시간 흐름 민감도 계수 (1.0 기준, 관계 특성에 따라 조정)
const MODE_FACTOR: Record<Mode, number> = {
  '일합':   1.00,
  '첫합':   0.95,
  '썸합':   0.90,
  '돈합':   0.85,
  '친구합': 0.80,
  '오래합': 0.70,
};

// 단순화된 Δ: 천간합 +1, 지지합 +1, 지지충 -1 (§2 점수표 미사용, 사용자 §1.1 승인)
// 양쪽 기둥을 한자로 정규화한 뒤 canonical 한자 테이블(STEM_HAP/BRANCH_HAP/CHUNG) lookup.
// 점수 의미(+1/+1/-1, clamp ±1)는 v1 과 동일 — 인코딩 매칭만 수정 (SCORING_VERSION 2).
function deltaScore(layerPillar: string, relDayPillar: string): number {
  if (!layerPillar || !relDayPillar) return 0;
  const layer = normalizeGanji(layerPillar);
  const rel = normalizeGanji(relDayPillar);
  if (layer.length < 2 || rel.length < 2) return 0;
  const lStem = layer[0];
  const lBranch = layer[1];
  const rStem = rel[0];
  const rBranch = rel[1];
  let s = 0;
  if (STEM_HAP[stemKey(lStem, rStem)] !== undefined) s += 1.0;
  if (BRANCH_HAP[branchKey(lBranch, rBranch)] !== undefined) s += 1.0;
  if (CHUNG[branchKey(lBranch, rBranch)] !== undefined) s -= 1.0;
  return Math.max(-1, Math.min(1, s));
}

// yunse_adjustment = clamp(10 × weighted_sum × mode_factor, -10, +10)
export function computeYunseAdjustment(
  yunse: YunseCore,
  relationDayPillar: string,
  mode: Mode,
): number {
  // current_index 범위 밖(레거시 jsonb 변형) 방어 — 대운 레이어만 0 으로 강등 (cross.ts 동일 정책)
  const cur = yunse.daeun.list[yunse.daeun.current_index];
  const sum =
      LAYER_WEIGHTS.daeun * deltaScore(cur?.pillar ?? '', relationDayPillar)
    + LAYER_WEIGHTS.seyun * deltaScore(yunse.seyun.current_pillar, relationDayPillar)
    + LAYER_WEIGHTS.wolun * deltaScore(yunse.wolun.current_pillar, relationDayPillar)
    + LAYER_WEIGHTS.iliun * deltaScore(yunse.iliun.today_pillar, relationDayPillar);
  const scaled = 10 * sum * MODE_FACTOR[mode];
  return Math.max(-10, Math.min(10, scaled));
}
