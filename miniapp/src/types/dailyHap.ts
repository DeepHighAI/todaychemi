/**
 * dailyHap.ts — 오늘 케미 카드 타입 (웹앱 src/types/dailyHap.ts 포트)
 *
 * next/* 없음 — 순수 타입 선언.
 */

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
  /** true = 개인화 LLM 결과가 아닌 기본 카드 */
  is_fallback?: boolean;
  /** G2 인연 종합 필드 — 인연 0건이면 null/undefined */
  relation_id?: string | null;
  relation_nickname?: string | null;
  today_compat_score?: number | null;
}

export type DailyHapResult = DailyHapCard | null;
