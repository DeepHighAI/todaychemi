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

// 마이플레이 LLM 출력 구조 (FGI §12.1)
// body: 350-450자, keywords: 5개, do_first: 3개
// 첫만남(first_meet)만 first_meet_tips 추가
export interface WhatifContent {
  body: string;
  keywords: [string, string, string, string, string];
  do_first: [string, string, string];
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
