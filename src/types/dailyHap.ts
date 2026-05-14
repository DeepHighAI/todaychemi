export const DAILY_HAP_ERROR_CODES = [
  'UNAUTHORIZED',
  'CHART_NOT_FOUND',
  'INTERNAL_ERROR',
] as const;

export type DailyHapErrorCode = (typeof DAILY_HAP_ERROR_CODES)[number];

export interface DailyHapCard {
  headline: string;
  headline_reason: string;
  avoid_phrase: string;
  avoid_phrase_reason: string;
  favorable_action: string;
  favorable_action_reason: string;
  reused_from_yesterday: boolean;
  compat_score?: number | null;
  headline_strength?: number | null;
  delta_vs_yesterday?: number | null;
}

export type DailyHapResult = DailyHapCard | null;
