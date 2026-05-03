import type { LlmModel } from './hapcard';

// db_schema.md §12 prompt_versions.status 허용값
export type PromptStatus = 'active' | 'canary' | 'rolled_back';

// db_schema.md §12 prompt_versions 테이블 1:1 매핑
// PK: (prompt_name, version)
export interface PromptVersion {
  prompt_name: string;
  version: string;
  content: string;
  status: PromptStatus;
  // canary_ratio: 0~1 (DDL check constraint)
  canary_ratio: number | null;
  notes: string | null;
  created_at: string;
}

// db_schema.md §14 banned_phrase_hits 테이블 1:1 매핑
export interface BannedPhraseHit {
  hit_id: string;
  prompt_version: string;
  phrase_category: string;
  phrase_matched: string;
  hapcard_id: string | null;
  created_at: string;
}

// 모델 사용처 매핑 (참고용 — 실제 검증은 LlmModel 타입에 의존)
export type PromptModelMap = Record<string, LlmModel>;
