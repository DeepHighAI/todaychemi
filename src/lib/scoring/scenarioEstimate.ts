import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  HOUR_STEM_BASE,
} from '@/lib/kasi/constants';
import {
  computeHapChungHyungHaeRaw,
  normalizeHapChungHyungHae,
} from '@/lib/scoring/hapChungHyungHae';
import { computeSipsinScore } from '@/lib/scoring/sipsin';
import { computeOhaengScore } from '@/lib/scoring/ohaeng';
import { weightsFor } from '@/lib/scoring/modeWeights';

export interface ScenarioEstimateResult {
  is_estimated: boolean;
  display_score: number;
  display_range: number;
  needs_badge: boolean;
}

// 천간+지지 인덱스로 시주 천간 계산
function buildHourPillar(dayStem: string, branch: string): string {
  const branchIdx = EARTHLY_BRANCHES.indexOf(branch as (typeof EARTHLY_BRANCHES)[number]);
  const stemBase = HOUR_STEM_BASE[dayStem] ?? 0;
  const stemIdx = (stemBase + branchIdx) % 10;
  return HEAVENLY_STEMS[stemIdx] + branch;
}

// 단일 시나리오 점수 (§1 공식)
function computeOneScore(self: ChartCore, rel: ChartCore, mode: Mode): number {
  const w = weightsFor(mode);
  const hapEvents = computeHapChungHyungHaeRaw(self, rel);
  const sHap = normalizeHapChungHyungHae(hapEvents);
  const sSipsin = computeSipsinScore(self.day_pillar[0], rel, mode);
  const sOhaeng = computeOhaengScore(self, rel);
  return Math.max(0, Math.min(100, w.hap * sHap + w.sipsin * sSipsin + w.ohaeng * sOhaeng));
}

// §5 시간 미상 시 시나리오 추정
// is_estimated=false 는 rel의 시주가 이미 있을 때 반환
export function computeScenarioEstimate(
  self: ChartCore,
  relation: ChartCore,
  mode: Mode,
): ScenarioEstimateResult {
  // 시주 있으면 추정 불필요
  if (relation.hour_pillar !== null) {
    const actual = computeOneScore(self, relation, mode);
    return {
      is_estimated: false,
      display_score: Math.round(actual),
      display_range: 0,
      needs_badge: false,
    };
  }

  // §5.1: 12지 각각에 대해 점수 산출
  const relDayStem = relation.day_pillar[0];
  const scores: number[] = [];

  for (const branch of EARTHLY_BRANCHES) {
    const hourPillar = buildHourPillar(relDayStem, branch);
    const relWithHour: ChartCore = { ...relation, hour_pillar: hourPillar };
    scores.push(computeOneScore(self, relWithHour, mode));
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const halfRange = (max - min) / 2;

  const display_score = Math.round(mean);
  const display_range = Math.round(halfRange);

  return {
    is_estimated: true,
    display_score,
    display_range,
    needs_badge: display_range >= 15,
  };
}
