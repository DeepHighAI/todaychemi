import type { YunseCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import { HEAVENLY_STEMS, EARTHLY_BRANCHES } from '@/lib/kasi/constants';
import { STEM_HAP, BRANCH_HAP, CHUNG } from '@/lib/scoring/constants';

// SCORING_VERSION 2 (2026-06-11): 프로덕션 ganji 는 한자다 —
// ssaju yunse(대운/세운/월운/일운)와 KASI relation.day_pillar 모두 한자('庚辰' 등).
// v1 은 한글 배열 indexOf 매칭이라 프로덕션에서 합·충 검출이 항상 실패해 보정이 0 이었다.
// 아래 변환 헬퍼는 today.ts 의 private hangulPillarToHanja 를 미러링한 것 (인코딩 면역):
// 한글 입력은 한자로 변환하고, 이미 한자면 그대로 통과시켜 두 인코딩 모두 수용한다.
const STEM_HANGUL = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
const BRANCH_HANGUL = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;

function hangulPillarToHanja(pillar: string): string {
  const stemIdx = STEM_HANGUL.indexOf(pillar[0] as (typeof STEM_HANGUL)[number]);
  const branchIdx = BRANCH_HANGUL.indexOf(pillar[1] as (typeof BRANCH_HANGUL)[number]);
  // 이미 한자면 그대로 통과
  if (stemIdx < 0 || branchIdx < 0) return pillar;
  return HEAVENLY_STEMS[stemIdx] + EARTHLY_BRANCHES[branchIdx];
}

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
  const layer = hangulPillarToHanja(layerPillar);
  const rel = hangulPillarToHanja(relDayPillar);
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
  const cur = yunse.daeun.list[yunse.daeun.current_index];
  const sum =
      LAYER_WEIGHTS.daeun * deltaScore(cur.pillar, relationDayPillar)
    + LAYER_WEIGHTS.seyun * deltaScore(yunse.seyun.current_pillar, relationDayPillar)
    + LAYER_WEIGHTS.wolun * deltaScore(yunse.wolun.current_pillar, relationDayPillar)
    + LAYER_WEIGHTS.iliun * deltaScore(yunse.iliun.today_pillar, relationDayPillar);
  const scaled = 10 * sum * MODE_FACTOR[mode];
  return Math.max(-10, Math.min(10, scaled));
}
