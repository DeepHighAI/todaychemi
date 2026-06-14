/**
 * hapcard.ts — 케미카드 관련 타입 (웹앱 참조용 포트)
 *
 * 웹앱 원본: src/types/hapcard.ts (read-only reference)
 * 변경: Zod 스키마 제거 (미니앱은 런타임 검증 불필요), Mode 타입 인라인.
 */

// 6모드 타입 (웹앱 src/types/mode.ts 참조)
export type Mode =
  | '일합'
  | '친구합'
  | '돈합'
  | '첫합'
  | '썸합'
  | '오래합';

export type LlmModel = 'gpt-5o' | 'gpt-5' | 'gpt-5-mini' | 'claude-fallback';

export interface HapcardVisuals {
  user: {
    day_pillar: string;
    day_master_element: '목' | '화' | '토' | '금' | '수';
    five_elements_counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  };
  relation: {
    day_pillar: string;
    day_master_element: '목' | '화' | '토' | '금' | '수';
    five_elements_counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  };
}

export interface ScenarioEstimateBreakdown {
  is_estimated: boolean;
  display_score: number;
  display_range: number;
  needs_badge: boolean;
}

export interface ScoreBreakdown {
  hap_chung_hyung_hae: number;
  sipsin: number;
  ohaeng: number;
  yunse_adjustment: number;
  mode_adjustment: number;
  scenario_estimate?: ScenarioEstimateBreakdown | null;
}

export interface OhaengInterpretationPoint {
  label: string;
  body: string;
}

export interface OhaengInterpretation {
  title: string;
  summary: string;
  points: OhaengInterpretationPoint[];
  tip: string;
}

export interface RoleAnalysisRole {
  title: string;
  sipsin: string;
  body: string;
}

export interface RoleAnalysisArea {
  title: string;
  body: string;
}

export interface RoleAnalysis {
  title: string;
  summary: string;
  roles: RoleAnalysisRole[];
  areas: RoleAnalysisArea[];
  basis: string[];
  tip: string;
}

export interface HapcardResult {
  hapcard_id: string;
  user_id: string;
  relation_id: string;
  mode: Mode;
  target_date: string;
  compat_score: number;
  score_breakdown: ScoreBreakdown;
  content: {
    main_text: string;
    cause_factors: Array<{ name: string; effect: string }>;
    classic_citation: Array<{ source: string; original: string; modern: string }>;
    actions: string[];
    why_cards: Array<{ title: string; reason: string; summary?: string }>;
    ohaeng_interpretation?: OhaengInterpretation;
    role_analysis?: RoleAnalysis;
    area_scores?: {
      talk?: number;
      attract?: number;
      speed?: number;
      money?: number;
      future?: number;
    };
  };
  prompt_version: string;
  llm_model: LlmModel;
  cache_key: string;
  user_chart_hash: string;
  relation_chart_hash: string;
  archived_at: string | null;
  version_label: string | null;
  created_at: string;
  visuals?: HapcardVisuals;
  relation_nickname?: string;
  relation_gender_normalized?: 'F' | 'M';
}

// /api/hapcards 에러 응답 코드
export type HapcardErrorCode =
  | 'INVALID_BODY'
  | 'UNAUTHORIZED'
  | 'PAYMENT_REQUIRED'
  | 'RATE_LIMITED'
  | 'USER_CHART_LOOKUP_FAILED'
  | 'USER_CHART_NOT_FOUND'
  | 'RELATION_CHART_LOOKUP_FAILED'
  | 'RELATION_CHART_NOT_FOUND'
  | 'GROUNDING_FAILED'
  | 'INTERNAL_ERROR';

// /api/hapcards/[id]/replay 결과
export interface HapcardReplayResult extends HapcardResult {
  replay_id: string;
  jinjin_date: string;
}

// GET /api/hapcards/[id]/snapshots 응답 타입 (ADR-033 7일 흐름 타임라인)
export interface HapcardSnapshotEntry {
  date: string;
  score: number | null;
  scoring_version?: string | null;
}

export interface HapcardSnapshotsResponse {
  snapshots: HapcardSnapshotEntry[];
  today_index: number;
}

// GET /api/hapcards/[id]/change 응답 — H-2 변화 폭 인디케이터
export type HapcardChangeStatus = 'comparable' | 'first' | 'version_changed';

export interface HapcardChangeFactor {
  factor: string;
  delta: number;
}

export interface HapcardChangeResponse {
  status: HapcardChangeStatus;
  delta: number | null;
  factors: HapcardChangeFactor[];
}
