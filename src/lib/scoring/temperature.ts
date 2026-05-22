const BASE_TEMPERATURE = 37.0;
const BASE_SCORE = 50;
const SCORE_POINTS_PER_DEGREE = 20;
const MIN_TEMPERATURE = 35.5;
const MAX_TEMPERATURE = 38.9;

export type RelationshipTemperatureBand = 'cold' | 'cool' | 'steady' | 'warm' | 'hot';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function scoreToTemperature(score: number): number {
  const safeScore = Number.isFinite(score) ? score : BASE_SCORE;
  const raw = BASE_TEMPERATURE + (clamp(safeScore, 0, 100) - BASE_SCORE) / SCORE_POINTS_PER_DEGREE;
  return roundToOneDecimal(clamp(raw, MIN_TEMPERATURE, MAX_TEMPERATURE));
}

export function formatTodayTemperature(score: number): string {
  return `${scoreToTemperature(score).toFixed(1)}°C`;
}

export function scoreDeltaToTemperatureDelta(deltaScore: number): number {
  if (!Number.isFinite(deltaScore)) return 0;
  return roundToOneDecimal(deltaScore / SCORE_POINTS_PER_DEGREE);
}

export function formatTemperatureDelta(deltaScore: number): string {
  const delta = scoreDeltaToTemperatureDelta(deltaScore);
  if (delta === 0) return '0.0°C';
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta).toFixed(1)}°C`;
}

export function temperatureBandFromScore(score: number): RelationshipTemperatureBand {
  const temperature = scoreToTemperature(score);
  if (temperature < 36.5) return 'cold';
  if (temperature < 37.0) return 'cool';
  if (temperature <= 37.5) return 'steady';
  if (temperature < 38.0) return 'warm';
  return 'hot';
}
