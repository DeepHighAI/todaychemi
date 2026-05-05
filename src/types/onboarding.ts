import { z } from 'zod';

import { BirthCalendarSchema, BirthTimeKnowledgeSchema, GenderSchema } from './relation';

const TimeStringRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const OnboardingRequestSchema = z
  .object({
    nickname: z.string().min(1).max(20),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    birth_date_calendar: BirthCalendarSchema,
    is_lunar_leap: z.boolean().default(false),
    birth_time_knowledge: BirthTimeKnowledgeSchema,
    birth_time: z.string().regex(TimeStringRegex).nullable(),
    gender: GenderSchema,
    consented_tos_version: z.string().min(1),
  })
  .strict();

export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;

export const ONBOARDING_ERROR_CODES = [
  'INVALID_BODY',
  'UNAUTHORIZED',
  'USER_ALREADY_ONBOARDED',
  'INTERNAL_ERROR',
] as const;

export type OnboardingErrorCode = (typeof ONBOARDING_ERROR_CODES)[number];
