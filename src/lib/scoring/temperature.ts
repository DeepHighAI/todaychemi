const BASE_TEMPERATURE = 37.0;
const BASE_SCORE = 50;
const SCORE_POINTS_PER_DEGREE = 20;
const MIN_TEMPERATURE = 35.5;
const MAX_TEMPERATURE = 38.9;
const DEFAULT_TEMPERATURE_PRECISION = 1;

export const DETAILED_TEMPERATURE_PRECISION = 2;

export type RelationshipTemperatureBand = 'cold' | 'cool' | 'steady' | 'warm' | 'hot';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToPrecision(value: number, precision = DEFAULT_TEMPERATURE_PRECISION): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function scoreToTemperature(score: number, precision = DEFAULT_TEMPERATURE_PRECISION): number {
  const safeScore = Number.isFinite(score) ? score : BASE_SCORE;
  const raw = BASE_TEMPERATURE + (clamp(safeScore, 0, 100) - BASE_SCORE) / SCORE_POINTS_PER_DEGREE;
  return roundToPrecision(clamp(raw, MIN_TEMPERATURE, MAX_TEMPERATURE), precision);
}

export function formatTodayTemperature(score: number, precision = DEFAULT_TEMPERATURE_PRECISION): string {
  return `${scoreToTemperature(score, precision).toFixed(precision)}°C`;
}

export function scoreDeltaToTemperatureDelta(deltaScore: number, precision = DEFAULT_TEMPERATURE_PRECISION): number {
  if (!Number.isFinite(deltaScore)) return 0;
  return roundToPrecision(deltaScore / SCORE_POINTS_PER_DEGREE, precision);
}

export function formatTemperatureDelta(deltaScore: number, precision = DEFAULT_TEMPERATURE_PRECISION): string {
  const delta = scoreDeltaToTemperatureDelta(deltaScore, precision);
  if (delta === 0) return `${delta.toFixed(precision)}°C`;
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta).toFixed(precision)}°C`;
}

export function temperatureDeltaBetweenScores(
  prevScore: number | null | undefined,
  currentScore: number,
  precision = DEFAULT_TEMPERATURE_PRECISION,
): number {
  if (prevScore === null || prevScore === undefined) return 0;
  return roundToPrecision(
    scoreToTemperature(currentScore, precision) - scoreToTemperature(prevScore, precision),
    precision,
  );
}

export function formatTemperatureDeltaBetweenScores(
  prevScore: number | null | undefined,
  currentScore: number,
  precision = DEFAULT_TEMPERATURE_PRECISION,
): string {
  const delta = temperatureDeltaBetweenScores(prevScore, currentScore, precision);
  if (delta === 0) return `${delta.toFixed(precision)}°C`;
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta).toFixed(precision)}°C`;
}

export function temperatureBandFromScore(score: number): RelationshipTemperatureBand {
  const temperature = scoreToTemperature(score);
  if (temperature < 36.5) return 'cold';
  if (temperature < 37.0) return 'cool';
  if (temperature <= 37.5) return 'steady';
  if (temperature < 38.0) return 'warm';
  return 'hot';
}
