import { z } from 'zod';

import { ModeSchema, type Mode } from './mode';

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
});
export type RelationCreate = z.infer<typeof RelationCreateSchema>;

// 합피드 카드 항목 — S-04 인연 목록 그리드 표시용 subset
export type FeedListItem = Pick<RelationRow, 'relation_id' | 'nickname' | 'mode' | 'created_at'>;

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
