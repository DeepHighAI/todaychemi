import type { z } from 'zod';

import { OnboardingRequestSchema } from './onboarding';

export const MeUpdateRequestSchema = OnboardingRequestSchema;

export type MeUpdateRequest = z.infer<typeof MeUpdateRequestSchema>;

export const ME_UPDATE_ERROR_CODES = [
  'INVALID_BODY',
  'UNAUTHORIZED',
  'NOT_ONBOARDED',
  'INTERNAL_ERROR',
] as const;
export type MeUpdateErrorCode = (typeof ME_UPDATE_ERROR_CODES)[number];
