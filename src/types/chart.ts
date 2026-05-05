import { z } from 'zod';

import { BirthCalendarSchema, BirthTimeKnowledgeSchema, GenderSchema, type Gender } from './relation';

// 사주 계산 입력 (DDL 기준 — `birth_time` 단일 time 필드)
const TimeStringRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const BirthDataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(TimeStringRegex).nullable(),
  time_knowledge: BirthTimeKnowledgeSchema,
  calendar: BirthCalendarSchema,
  is_lunar_leap: z.boolean().default(false),
  gender: GenderSchema,
});
export type BirthData = z.infer<typeof BirthDataSchema>;

// 사주 계산 결과 (LLM 페이로드 허용 형태 — chart_core)
// PII: birth_date / gender 원본은 포함 금지 (docs/legal/pii_minimization.md)
export interface ChartCore {
  year_pillar: string;
  month_pillar: string | null;
  day_pillar: string;
  hour_pillar: string | null;
  day_master_element: '목' | '화' | '토' | '금' | '수';
  five_elements_counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  // 정규화된 성별 — 원본 gender 대신 chart 계산 결과로만 LLM에 전달
  gender_normalized: Gender;
}

export type ChartHash = string;

// 온보딩 폼 입력 — S-01-B 가입 후 자신의 사주 정보 등록 (별명 + 생년월일)
export interface OnboardingFormInput {
  nickname: string;
  birth: BirthData;
}

export interface TheoryProfile {
  profile_version: string;
  ja_si_mode: 'late_zi' | 'early_zi';
  longitude_correction: boolean;
}

export const DEFAULT_THEORY_PROFILE_VERSION = 'v1';
