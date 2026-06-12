import { z } from 'zod';
import { ModeSchema, type Mode } from './mode';

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

// LLM 모델 식별자 (db_schema.md §5 hapcards.llm_model 허용값 — migration 0006/0026 CHECK 제약과 동일)
export type LlmModel = 'gpt-5o' | 'gpt-5' | 'gpt-5-mini' | 'claude-fallback';

// 오늘 케미 시각 보조 데이터 — DB 저장 X, 런타임 첨부 (builder.ts → transport)
// ChartCore에서 파생: day_pillar(일주 chip), day_master_element(오행 컬러), five_elements_counts(오행맵 막대)
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

// score_breakdown 필드 구조 (DB jsonb 컬럼 매핑, Y3+ yunse_adjustment 포함)
// G-4 (2026-06-13): scenario_estimate — 시간 미상 시 12지 시나리오 ± 범위 (결정형 산출,
// ADR-035 점수 본체 무접촉 — 표시 전용). 기존 row 호환 위해 optional.
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

export const ScoreBreakdownSchema = z.object({
  hap_chung_hyung_hae: z.number(),
  sipsin: z.number(),
  ohaeng: z.number(),
  yunse_adjustment: z.number(),
  mode_adjustment: z.number(),
  scenario_estimate: z
    .object({
      is_estimated: z.boolean(),
      display_score: z.number(),
      display_range: z.number(),
      needs_badge: z.boolean(),
    })
    .nullable()
    .optional(),
});

// DB row 런타임 검증 — score_breakdown shape 핵심 확인, 나머지는 passthrough
export const HapcardDbRowSchema = z
  .object({
    hapcard_id: z.string(),
    user_id: z.string(),
    relation_id: z.string(),
    mode: ModeSchema,
    target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    compat_score: z.number(),
    score_breakdown: ScoreBreakdownSchema,
  })
  .passthrough();

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

// 오늘 케미 결과 — db_schema.md §5 hapcards 테이블 1:1 매핑
// ADR-035: compat_score는 결정형 (LLM 점수 개입 금지). 본 인터페이스의 score 필드는 fortune-core 출력만 저장.
export interface HapcardResult {
  hapcard_id: string;
  user_id: string;
  relation_id: string;
  mode: Mode;
  // 오늘 케미는 KST 날짜별 결과다. 같은 인연/모드도 날짜가 다르면 별도 분석한다.
  target_date: string;
  // 점수 (DDL: numeric(5,2))
  compat_score: number;
  score_breakdown: ScoreBreakdown;
  // 카드 본문 (DDL: jsonb)
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
  // 클라이언트 렌더 우선순위 — DB 컬럼은 아니지만 ADR-016 컴포넌트 잠금 표현
  viewport_priority?: HapcardComponent[];
  // 런타임 시각 보조 데이터 — DB 컬럼 X, builder.ts가 ChartCore에서 파생해 첨부
  visuals?: HapcardVisuals;
  // 공유 UX용 인연 별명 — builder.ts가 relation JOIN 후 첨부 (선택)
  relation_nickname?: string;
  // 공유 UX용 성별 — builder.ts가 relation_charts.chart_core에서 파생 (선택)
  relation_gender_normalized?: 'F' | 'M';
}

// POST /api/hapcards 요청 스키마 — .strict()로 PII 등 불명 필드 거부 (ADR-004)
export const HapcardRequestSchema = z
  .object({
    relation_id: z.string().uuid(),
    mode: ModeSchema,
    theory_profile_version: z.string().min(1),
    question_slot: z.string().optional(),
  })
  .strict();

export type HapcardRequest = z.infer<typeof HapcardRequestSchema>;

// route.ts 에러 응답 code 허용값 — 8가지 (exhaustive)
export const HAPCARD_ERROR_CODES = [
  'INVALID_BODY',
  'UNAUTHORIZED',
  'USER_CHART_LOOKUP_FAILED',
  'USER_CHART_NOT_FOUND',
  'RELATION_CHART_LOOKUP_FAILED',
  'RELATION_CHART_NOT_FOUND',
  'GROUNDING_FAILED',
  'INTERNAL_ERROR',
] as const;

export type HapcardErrorCode = (typeof HAPCARD_ERROR_CODES)[number];

// 케미 다시 맞추기 결과 — hapcard_replays 테이블 1:1 매핑 + 원본 HapcardResult 구조 재사용
export interface HapcardReplayResult extends HapcardResult {
  replay_id: string;
  jinjin_date: string; // YYYY-MM-DD (UTC+9)
}

// GET /api/hapcards/[id]/snapshots 응답 타입 (ADR-033 7일 흐름 타임라인)
export interface HapcardSnapshotEntry {
  date: string;        // YYYY-MM-DD (KST)
  score: number | null; // null = 데이터 없음 (미래 날짜 포함)
  // ADR-036: scoring_version 이 다른 막대 간 직접 비교 금지 — 타임라인 버전 경계 마커 판정용
  // (null = 데이터 없음, optional = 레거시 응답 하위호환)
  scoring_version?: string | null;
}

export interface HapcardSnapshotsResponse {
  snapshots: HapcardSnapshotEntry[]; // 길이 7 (D-3 ~ D+3)
  today_index: number;                // 항상 3
}

export const SNAPSHOTS_ERROR_CODES = [
  'UNAUTHORIZED',
  'HAPCARD_NOT_FOUND',
  'INTERNAL_ERROR',
] as const;

export type SnapshotsErrorCode = (typeof SNAPSHOTS_ERROR_CODES)[number];

// POST /api/hapcards/[id]/replay 요청 스키마 — .strict()로 PII 불명 필드 거부
export const ReplayRequestSchema = z
  .object({
    replay_reason: z.string().max(500).optional(),
  })
  .strict();

export type ReplayRequest = z.infer<typeof ReplayRequestSchema>;

// replay route 에러 응답 code 허용값
export const REPLAY_ERROR_CODES = [
  'INVALID_BODY',
  'UNAUTHORIZED',
  'HAPCARD_NOT_FOUND',
  'INSUFFICIENT_TOKENS',
  'REPLAY_DURING_OUTAGE',
  'INTERNAL_ERROR',
] as const;

export type ReplayErrorCode = (typeof REPLAY_ERROR_CODES)[number];
