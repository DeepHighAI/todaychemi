import type { Mode } from './mode';

// 결과 카드 6 컴포넌트 (ADR-016: Phase 1 잠금)
export type HapcardComponent =
  | 'header'
  | 'gauge'
  | 'ohaeng_map'
  | 'body_3section'
  | 'evidence'
  | 'footer'
  | 'glossary'
  | 'mini_radar';

// LLM 모델 식별자 (db_schema.md §5 hapcards.llm_model 허용값)
export type LlmModel = 'gpt-5o' | 'gpt-5' | 'gpt-5-mini' | 'claude-fallback';

// 합카드 결과 — db_schema.md §5 hapcards 테이블 1:1 매핑
// ADR-035: compat_score는 결정형 (LLM 점수 개입 금지). 본 인터페이스의 score 필드는 fortune-core 출력만 저장.
export interface HapcardResult {
  hapcard_id: string;
  user_id: string;
  relation_id: string;
  mode: Mode;
  // 점수 (DDL: numeric(5,2))
  compat_score: number;
  score_breakdown: {
    hap_chung_hyung_hae: number;
    sipsin: number;
    ohaeng: number;
    mode_adjustment: number;
  };
  // 카드 본문 (DDL: jsonb)
  content: {
    main_text: string;
    cause_factors: Array<{ name: string; effect: string }>;
    classic_citation: Array<{ source: string; original: string; modern: string }>;
    actions: string[];
    why_cards: Array<{ title: string; reason: string }>;
  };
  prompt_version: string;
  llm_model: LlmModel;
  cache_key: string;
  user_chart_hash: string;
  relation_chart_hash: string;
  archived_at: string | null;
  version_label: string | null;
  created_at: string;
  // 클라이언트 렌더 우선순위 — DB 컬럼은 아니지만 ADR-016 컴포넌트 잠금 표현
  viewport_priority?: HapcardComponent[];
}
