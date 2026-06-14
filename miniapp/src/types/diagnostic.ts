/**
 * diagnostic.ts — 또 다른 나(whatif) 타입 정의
 *
 * 웹앱 원본: src/types/diagnostic.ts (read-only reference)
 * Zod 의존성이 없으므로 타입만 포트 (Zod 없이 순수 TS).
 */

// 6모드 진단 타입 (코드 식별자는 불변 — ADR §8)
export const DIAGNOSTIC_TYPE = {
  WORK: 'work',
  LOVE: 'love',
  CONFLICT: 'conflict',
  LEADERSHIP: 'leadership',
  MONEY: 'money',
  FIRST_MEET: 'first_meet',
} as const;

export type DiagnosticType = (typeof DIAGNOSTIC_TYPE)[keyof typeof DIAGNOSTIC_TYPE];

// 유효한 DiagnosticType 값 목록 (런타임 검증용)
const VALID_DIAGNOSTIC_TYPES: ReadonlyArray<string> = Object.values(DIAGNOSTIC_TYPE);

export function isDiagnosticType(v: unknown): v is DiagnosticType {
  return typeof v === 'string' && VALID_DIAGNOSTIC_TYPES.includes(v);
}

// 고전 인용 출처 (LLM grounding, ADR-018)
export interface ClassicCitation {
  asset_id: string;
  source_title: string;
  source_chapter: string;
  original_text: string;
  modern_translation: string;
}

// 또 다른 나 LLM 출력 구조
export interface WhatifContent {
  body: string;
  keywords: [string, string, string, string, string];
  do_first: [string, string, string];
  first_meet_tips?: [string, string, string];
  classic_citation?: ClassicCitation[];
}

// whatif_results DB row + 런타임 응답
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
