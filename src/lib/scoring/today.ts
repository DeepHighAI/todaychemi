import type { ChartCore } from '@/types/chart';
import { HEAVENLY_STEMS, EARTHLY_BRANCHES } from '@/lib/kasi/constants';
import {
  computeHapChungHyungHaeRaw,
  normalizeHapChungHyungHae,
} from '@/lib/scoring/hapChungHyungHae';
import { computeSipsinScore } from '@/lib/scoring/sipsin';
import { computeOhaengScore } from '@/lib/scoring/ohaeng';
import { STEM_HAP, BRANCH_HAP, CHUNG } from '@/lib/scoring/constants';

// G2 / Phase 3 — 오늘 합온도 결정형 점수식
// 합점수(SCORING_VERSION)와 독립. ADR-035: LLM 미개입, 100% 결정형.

export const TODAY_SCORING_VERSION = '1.0.0' as const;

// W1 사용자 확정 (2026-05-28) — sub-spec 초안 0.30/0.20/0.20/0.30 에서 일진 영향 +10%p 강화
export const TODAY_WEIGHTS = {
  hap_chung: 0.25,
  sipsin: 0.15,
  ohaeng: 0.20,
  today_pillar_influence: 0.40,
} as const;

// today_pillar 은 ssaju 경로(YunseCore.iliun.today_pillar) → 한글 (예: '갑자')
// day_pillar 은 KASI 경로(normalize.ts) → 한자 (예: '甲子')
// 비교를 위해 한글 → 한자 변환.
const STEM_HANGUL = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
const BRANCH_HANGUL = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;

function hangulPillarToHanja(pillar: string): string {
  const stemIdx = STEM_HANGUL.indexOf(pillar[0] as (typeof STEM_HANGUL)[number]);
  const branchIdx = BRANCH_HANGUL.indexOf(pillar[1] as (typeof BRANCH_HANGUL)[number]);
  // 이미 한자면 그대로
  if (stemIdx < 0 || branchIdx < 0) return pillar;
  return HEAVENLY_STEMS[stemIdx] + EARTHLY_BRANCHES[branchIdx];
}

// 정규화 키 (작은 인덱스 먼저) — constants 와 동일 규칙
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

// today_pillar 과 target_pillar(self.day 또는 relation.day) 간의 합·충 영향 delta ∈ [-1, +1]
// 천간합 +1.0 / 지지합 +1.0 / 지지충 -1.0 → clamp(-1, +1)
// 한자 기준 비교 (둘 다 한자로 변환된 후 호출).
function deltaScoreHanja(todayHanja: string, targetHanja: string): number {
  if (!todayHanja || !targetHanja || todayHanja.length < 2 || targetHanja.length < 2) {
    return 0;
  }
  const tStem = todayHanja[0];
  const tBranch = todayHanja[1];
  const xStem = targetHanja[0];
  const xBranch = targetHanja[1];

  let s = 0;
  if (STEM_HAP[stemKey(tStem, xStem)] !== undefined) s += 1.0;
  if (BRANCH_HAP[branchKey(tBranch, xBranch)] !== undefined) s += 1.0;
  if (CHUNG[branchKey(tBranch, xBranch)] !== undefined) s -= 1.0;
  return Math.max(-1, Math.min(1, s));
}

// today_pillar_influence ∈ [0, 1] = 0.5 + 0.25 * delta_self + 0.25 * delta_rel
// (delta ∈ [-1, +1] → 0.5 ± 0.25 양쪽 → 결과 ∈ [0, 1])
function computeTodayPillarInfluence(
  self: ChartCore,
  relation: ChartCore,
): number {
  const todayHanja = hangulPillarToHanja(self.yunse.iliun.today_pillar);
  const selfDayHanja = hangulPillarToHanja(self.day_pillar);
  const relDayHanja = hangulPillarToHanja(relation.day_pillar);

  const dSelf = deltaScoreHanja(todayHanja, selfDayHanja);
  const dRel = deltaScoreHanja(todayHanja, relDayHanja);

  const value = 0.5 + 0.25 * dSelf + 0.25 * dRel;
  return Math.max(0, Math.min(1, value));
}

// sub-spec 단일 가중치 — mode 인자 안 받음 (sipsin 내부는 '일합' 고정 사용)
// today_compat_score = round(clamp(0, 100, 100 * weighted_sum))
export function computeTodayCompatScore(
  self: ChartCore,
  relation: ChartCore,
  _todayDate: string,
): number {
  // hap_chung (0~100) — 기존 hap_chung 부품 재사용
  const hapEvents = computeHapChungHyungHaeRaw(self, relation);
  const sHapChung = normalizeHapChungHyungHae(hapEvents);

  // sipsin (0~100) — today 는 mode-agnostic, '일합' axis(authority)로 고정 (관계 일반)
  const sSipsin = computeSipsinScore(self.day_pillar[0], relation, '일합');

  // ohaeng (0~100) — mode 무관
  const sOhaeng = computeOhaengScore(self, relation);

  // today_pillar_influence (0~1)
  const tpi = computeTodayPillarInfluence(self, relation);

  // weighted_sum: 4축 모두 0~1 범위로 정규화 후 가중평균
  const weighted =
      TODAY_WEIGHTS.hap_chung * (sHapChung / 100)
    + TODAY_WEIGHTS.sipsin * (sSipsin / 100)
    + TODAY_WEIGHTS.ohaeng * (sOhaeng / 100)
    + TODAY_WEIGHTS.today_pillar_influence * tpi;

  return Math.round(Math.max(0, Math.min(100, 100 * weighted)));
}
