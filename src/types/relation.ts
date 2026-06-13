import { z } from 'zod';

import { ModeSchema, type Mode } from './mode';
import type { ChartCore } from './chart';

// 출생시간 인지도 (db_schema.md §3 relations.birth_time_knowledge)
export const BirthTimeKnowledgeSchema = z.enum(['exact', 'approximate', 'unknown']);
export type BirthTimeKnowledge = z.infer<typeof BirthTimeKnowledgeSchema>;

// 음/양력
export const BirthCalendarSchema = z.enum(['solar', 'lunar']);
export type BirthCalendar = z.infer<typeof BirthCalendarSchema>;

// gender: DDL은 'M'|'F' (db_schema.md §3 relations.gender check constraint)
export const GenderSchema = z.enum(['M', 'F']);
export type Gender = z.infer<typeof GenderSchema>;

// HH:mm:ss 또는 HH:mm 형태의 time 문자열 (Postgres `time` 타입 표현)
const TimeStringRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

type BirthInputConsistency = {
  birth_date_calendar: BirthCalendar;
  is_lunar_leap: boolean;
  birth_time_knowledge: BirthTimeKnowledge;
  birth_time: string | null;
};

export function validateBirthInputConsistency(
  value: BirthInputConsistency,
  ctx: z.RefinementCtx,
) {
  if (value.birth_date_calendar === 'solar' && value.is_lunar_leap) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['is_lunar_leap'],
      message: 'solar birth_date_calendar cannot use lunar leap flag',
    });
  }

  if (value.birth_time_knowledge === 'unknown' && value.birth_time !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['birth_time'],
      message: 'birth_time must be null when birth_time_knowledge is unknown',
    });
  }

  if (value.birth_time_knowledge !== 'unknown' && value.birth_time === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['birth_time'],
      message: 'birth_time is required when birth_time_knowledge is exact or approximate',
    });
  }
}

export const RelationCreateSchema = z.object({
  nickname: z.string().min(1).max(20),                              // ADR-011: 별명만
  mode: ModeSchema,                                                  // 6모드 분류
  gender: GenderSchema,
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birth_date_calendar: BirthCalendarSchema,
  is_lunar_leap: z.boolean().default(false),
  birth_time_knowledge: BirthTimeKnowledgeSchema,
  birth_time: z.string().regex(TimeStringRegex).nullable(),         // Postgres `time` 직렬화 형식
  birth_longitude: z.number().min(-180).max(180).nullable().optional(), // Expert Mode 경도 보정용만
  consent_confirmed: z.boolean().default(false),
  is_primary: z.boolean().default(false),
}).strict().superRefine(validateBirthInputConsistency);
export type RelationCreate = z.infer<typeof RelationCreateSchema>;

// 케미피드 카드 항목 — S-04 인연 목록 그리드 표시용 subset
export type FeedListItem = Pick<RelationRow, 'relation_id' | 'nickname' | 'mode' | 'created_at'> & {
  compat_score?: number | null;
};

// Y4 ADR-036 — 케미피드 응답 항목 (compat_score + change_score + badge flag, 서버 정렬 후 반환)
export interface FeedItem {
  relation_id: string;
  nickname: string;
  mode: Mode;
  compat_score: number | null;        // 스냅샷 0건이면 null
  change_score: number;               // prev 스냅샷 없으면 0
  has_significant_change: boolean;    // |change_score| >= CHANGE_SCORE_THRESHOLD
  created_at: string;
}

// 합점수 흐름 — hapcard_score_snapshots 에서 날짜별 dedup 후 asc 정렬
export interface FlowPoint {
  date: string;   // YYYY-MM-DD
  score: number;
}

// GET /api/relations/[id] 응답
export interface RelationDetailResponse {
  relation: Pick<RelationRow, 'relation_id' | 'nickname' | 'mode' | 'created_at'>;
  chart: ChartCore | null;
  flow: FlowPoint[];
}

// S-09 인연 디테일 타임라인 (PRD §5.2, §1.1 2026-06-13: 메모 제외·최신순·v1 표시 전용)
export type RelationTimelineEventType = 'registered' | 'hapcard' | 'replay';

// 메타데이터만 — 본문(content)·점수 미포함 (ADR-039 read-path: 결제 게이트 불필요 범위)
export interface RelationTimelineEvent {
  type: RelationTimelineEventType;
  occurred_at: string;        // timestamptz ISO
  mode: Mode | null;          // registered 이벤트는 null, replay 는 소속 케미카드의 모드
}

// GET /api/relations/[id]/timeline 응답 — 최신순(desc), 등록 이벤트는 상한과 무관하게 항상 마지막
export interface RelationTimelineResponse {
  events: RelationTimelineEvent[];
}

export const RELATION_ERROR_CODES = [
  'INVALID_BODY',
  'UNAUTHORIZED',
  'INTERNAL_ERROR',
  'RELATION_NOT_FOUND',
] as const;
export type RelationErrorCode = (typeof RELATION_ERROR_CODES)[number];

// DB Row (db_schema.md §3 relations 테이블 1:1 매핑)
// ADR-011: name / display_name / real_name 컬럼은 절대 추가 금지.
export interface RelationRow {
  relation_id: string;
  user_id: string;
  nickname: string;
  mode: Mode;
  birth_date: string;
  birth_date_calendar: BirthCalendar;
  is_lunar_leap: boolean;
  birth_time_knowledge: BirthTimeKnowledge;
  birth_time: string | null;
  birth_longitude: number | null;
  gender: Gender;
  consent_confirmed: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}
