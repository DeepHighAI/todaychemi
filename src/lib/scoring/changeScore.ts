import type { ScoreBreakdown } from '@/types/hapcard';

export function computeChangeScore(prev: number | null, current: number): number {
  if (prev === null) return 0;
  return current - prev;
}

// 변화 요인 비교 대상 = 숫자 점수 구성요소만 — scenario_estimate(G-4, 표시 전용 객체)는 제외
const NUMERIC_FACTOR_KEYS = [
  'hap_chung_hyung_hae',
  'sipsin',
  'ohaeng',
  'yunse_adjustment',
  'mode_adjustment',
] as const;

export function topChangedFactors(
  prev: ScoreBreakdown | null,
  current: ScoreBreakdown,
  limit = 3,
): Array<{ factor: string; delta: number }> {
  if (prev === null) return [];

  return NUMERIC_FACTOR_KEYS
    .map((factor) => ({ factor, delta: current[factor] - (prev[factor] ?? 0) }))
    .filter((entry) => entry.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}
