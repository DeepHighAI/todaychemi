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
  // G2 (Phase 3) — 오늘카드 인연 종합. 인연 0건 사용자는 모두 undefined/null.
  relation_id?: string | null;
  relation_nickname?: string | null;
  today_compat_score?: number | null;
  // legacy (Phase 3 이전, 미사용 가능). 후속 PR에서 제거 검토.
  compat_score?: number | null;
  headline_strength?: number | null;
  delta_vs_yesterday?: number | null;
}

export type DailyHapResult = DailyHapCard | null;
