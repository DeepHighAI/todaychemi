import type { ScoreBreakdown } from '@/types/hapcard';

export function computeChangeScore(prev: number | null, current: number): number {
  if (prev === null) return 0;
  return current - prev;
}

export function topChangedFactors(
  prev: ScoreBreakdown | null,
  current: ScoreBreakdown,
  limit = 3,
): Array<{ factor: string; delta: number }> {
  if (prev === null) return [];

  const keys = Object.keys(current) as (keyof ScoreBreakdown)[];
  return keys
    .map((factor) => ({ factor, delta: current[factor] - (prev[factor] ?? 0) }))
    .filter((entry) => entry.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}
