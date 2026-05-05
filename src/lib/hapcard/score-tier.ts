export type ScoreTier = 'weak' | 'fair' | 'good' | 'great';

export function scoreToTier(score: number): ScoreTier {
  if (score < 40) return 'weak';
  if (score < 60) return 'fair';
  if (score < 80) return 'good';
  return 'great';
}
