import type { YunseCore } from '@/types/chart';
import type { Mode } from '@/types/mode';

// 한글 기둥 문자열 기반 — Hanja constants 와 별도 (ADR-035 결정형)
const HANGUL_STEMS = ['갑','을','병','정','무','기','경','신','임','계'] as const;
const HANGUL_BRANCHES = ['자','축','인','묘','진','사','오','미','신','유','술','해'] as const;

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

// 천간합: 간격 5 (갑-기, 을-경, 병-신, 정-임, 무-계)
function detectStemHap(s1: string, s2: string): boolean {
  const i1 = HANGUL_STEMS.indexOf(s1 as (typeof HANGUL_STEMS)[number]);
  const i2 = HANGUL_STEMS.indexOf(s2 as (typeof HANGUL_STEMS)[number]);
  if (i1 < 0 || i2 < 0) return false;
  return Math.abs(i1 - i2) === 5;
}

// 지지합 (6합): 자축(0+1=1), 나머지 5쌍(인해·묘술·진유·사신·오미) 합=13
function detectBranchHap(b1: string, b2: string): boolean {
  const i1 = HANGUL_BRANCHES.indexOf(b1 as (typeof HANGUL_BRANCHES)[number]);
  const i2 = HANGUL_BRANCHES.indexOf(b2 as (typeof HANGUL_BRANCHES)[number]);
  if (i1 < 0 || i2 < 0) return false;
  const s = i1 + i2;
  return s === 1 || s === 13;
}

// 지지충 (6충): 간격 6 (자오·축미·인신·묘유·진술·사해)
function detectBranchChung(b1: string, b2: string): boolean {
  const i1 = HANGUL_BRANCHES.indexOf(b1 as (typeof HANGUL_BRANCHES)[number]);
  const i2 = HANGUL_BRANCHES.indexOf(b2 as (typeof HANGUL_BRANCHES)[number]);
  if (i1 < 0 || i2 < 0) return false;
  return Math.abs(i1 - i2) === 6;
}

// 단순화된 Δ: 천간합 +1, 지지합 +1, 지지충 -1 (§2 점수표 미사용, 사용자 §1.1 승인)
function deltaScore(layerPillar: string, relDayPillar: string): number {
  if (!layerPillar || !relDayPillar) return 0;
  const lStem = layerPillar[0];
  const lBranch = layerPillar[1];
  const rStem = relDayPillar[0];
  const rBranch = relDayPillar[1];
  let s = 0;
  if (detectStemHap(lStem, rStem)) s += 1.0;
  if (detectBranchHap(lBranch, rBranch)) s += 1.0;
  if (detectBranchChung(lBranch, rBranch)) s -= 1.0;
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
