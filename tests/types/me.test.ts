import { describe, it, expect } from 'vitest';
import { MeUpdateRequestSchema } from '@/types/me';

const VALID_UPDATE = {
  nickname: '하늘달',
  birth_date: '1991-03-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '14:30',
  gender: 'F',
  // consented_tos_version 없음 — 편집에서 제외
} as const;

describe('MeUpdateRequestSchema', () => {
  it('유효한 7필드 페이로드 통과', () => {
    const result = MeUpdateRequestSchema.safeParse(VALID_UPDATE);
    expect(result.success).toBe(true);
  });

  it('consented_tos_version 포함 시 strict 거절', () => {
    const bad = { ...VALID_UPDATE, consented_tos_version: 'v0.1' };
    const result = MeUpdateRequestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
