import { z } from 'zod';

export const DIAGNOSTIC_TYPE = {
  WORK: 'work',
  LOVE: 'love',
  CONFLICT: 'conflict',
  LEADERSHIP: 'leadership',
  MONEY: 'money',
  FIRST_MEET: 'first_meet',
} as const;

export const DiagnosticTypeSchema = z.enum([
  'work',
  'love',
  'conflict',
  'leadership',
  'money',
  'first_meet',
]);

export type DiagnosticType = z.infer<typeof DiagnosticTypeSchema>;

// 고전 인용 출처 (LLM grounding, ADR-018)
export interface ClassicCitation {
  asset_id: string;
  source_title: string;
  source_chapter: string;
  original_text: string;
  modern_translation: string;
}

export interface WhatifTodayContext {
  title: string;
  summary: string;
  day_signal: string;
}

export interface WhatifSajuBasis {
  day_master: string;
  dominant_sipsin: string[];
  missing_sipsin: string[];
  sinkang: string | null;
  yongsin_candidates: string[];
  notes: [string, string, string];
}

export interface WhatifSituationReading {
  strength: [string, string, string];
  caution: [string, string, string];
}

// 오늘의 나는? LLM 출력 구조 (FGI §12.1)
// 날짜별 자기진단 결과: 요약 + 명리 근거 + 상황별 강점/주의 + 행동 카드
// 처음 보는 나(first_meet)만 first_meet_tips 추가
export interface WhatifContent {
  body: string;
  keywords: [string, string, string, string, string];
  today_context?: WhatifTodayContext;
  saju_basis?: WhatifSajuBasis;
  situation_reading?: WhatifSituationReading;
  do_first: [string, string, string];
  avoid_today?: [string, string];
  first_meet_tips?: [string, string, string];
  classic_citation?: ClassicCitation[];
}

// whatif_results DB row + 런타임 응답 (merged)
export interface WhatifResult {
  id: string;
  user_id: string;
  type: DiagnosticType;
  content: WhatifContent;
  prompt_version: string;
  llm_model: string;
  cache_key: string;
  chart_hash: string;
  target_date: string;
  created_at: string;
}

// route 에러 응답 code 허용값
export const WHATIF_ERROR_CODES = [
  'INVALID_TYPE',
  'UNAUTHORIZED',
  'USER_CHART_NOT_FOUND',
  'INSUFFICIENT_TOKENS',
  'GROUNDING_FAILED',
  'INTERNAL_ERROR',
] as const;

export type WhatifErrorCode = (typeof WHATIF_ERROR_CODES)[number];
