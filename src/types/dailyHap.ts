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
  // Response-only marker: true means this is a safe generic card, not a personalized LLM result.
  is_fallback?: boolean;
  // G2 (Phase 3) — 오늘카드 인연 종합. 인연 0건 사용자는 모두 undefined/null.
  relation_id?: string | null;
  relation_nickname?: string | null;
  today_compat_score?: number | null;
}

export type DailyHapResult = DailyHapCard | null;
