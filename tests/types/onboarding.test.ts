import { describe, it, expect } from 'vitest';
import { OnboardingRequestSchema, ONBOARDING_ERROR_CODES } from '@/types/onboarding';

const validBodyExact = {
  nickname: '하늘달',
  birth_date: '1991-03-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '14:30',
  gender: 'F',
  consented_tos_version: 'v0.1',
};

describe('OnboardingRequestSchema', () => {
  it('parses a valid body with exact birth_time', () => {
    const result = OnboardingRequestSchema.safeParse(validBodyExact);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.nickname).toBe('하늘달');
    expect(result.data.birth_time_knowledge).toBe('exact');
    expect(result.data.birth_time).toBe('14:30');
  });

  it('parses a valid body with approximate birth_time', () => {
    const result = OnboardingRequestSchema.safeParse({
      ...validBodyExact,
      birth_time_knowledge: 'approximate',
      birth_time: '09:00',
    });
    expect(result.success).toBe(true);
  });

  it('parses a valid body with unknown birth_time — birth_time null', () => {
    const result = OnboardingRequestSchema.safeParse({
      ...validBodyExact,
      birth_time_knowledge: 'unknown',
      birth_time: null,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.birth_time).toBeNull();
  });

  it('parses HH:MM:SS format birth_time', () => {
    const result = OnboardingRequestSchema.safeParse({
      ...validBodyExact,
      birth_time: '14:30:00',
    });
    expect(result.success).toBe(true);
  });

  it('defaults is_lunar_leap to false when omitted', () => {
    const body = structuredClone(validBodyExact);
    delete (body as any).is_lunar_leap;
    const result = OnboardingRequestSchema.safeParse(body);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.is_lunar_leap).toBe(false);
  });

  it('rejects empty nickname', () => {
    expect(OnboardingRequestSchema.safeParse({ ...validBodyExact, nickname: '' }).success).toBe(false);
  });

  it('rejects nickname longer than 20 chars', () => {
    expect(
      OnboardingRequestSchema.safeParse({ ...validBodyExact, nickname: 'a'.repeat(21) }).success,
    ).toBe(false);
  });

  it('rejects invalid birth_date format', () => {
    expect(
      OnboardingRequestSchema.safeParse({ ...validBodyExact, birth_date: '91-3-15' }).success,
    ).toBe(false);
  });

  it('rejects unknown birth_date_calendar value', () => {
    expect(
      OnboardingRequestSchema.safeParse({ ...validBodyExact, birth_date_calendar: 'gregorian' }).success,
    ).toBe(false);
  });

  it('rejects unknown birth_time_knowledge value', () => {
    expect(
      OnboardingRequestSchema.safeParse({ ...validBodyExact, birth_time_knowledge: 'maybe' }).success,
    ).toBe(false);
  });

  it('rejects unknown gender value', () => {
    expect(
      OnboardingRequestSchema.safeParse({ ...validBodyExact, gender: 'X' }).success,
    ).toBe(false);
  });

  it('rejects invalid birth_time format', () => {
    expect(
      OnboardingRequestSchema.safeParse({ ...validBodyExact, birth_time: '25:00' }).success,
    ).toBe(false);
  });

  it('rejects empty consented_tos_version', () => {
    expect(
      OnboardingRequestSchema.safeParse({ ...validBodyExact, consented_tos_version: '' }).success,
    ).toBe(false);
  });

  it('rejects extra field birth_place — PII .strict() 가드', () => {
    expect(
      OnboardingRequestSchema.safeParse({ ...validBodyExact, birth_place: '서울' }).success,
    ).toBe(false);
  });
});

describe('ONBOARDING_ERROR_CODES', () => {
  it('contains exactly 4 error codes', () => {
    expect(ONBOARDING_ERROR_CODES).toHaveLength(4);
  });

  it('includes INVALID_BODY', () => {
    expect(ONBOARDING_ERROR_CODES).toContain('INVALID_BODY');
  });

  it('includes UNAUTHORIZED', () => {
    expect(ONBOARDING_ERROR_CODES).toContain('UNAUTHORIZED');
  });

  it('includes USER_ALREADY_ONBOARDED', () => {
    expect(ONBOARDING_ERROR_CODES).toContain('USER_ALREADY_ONBOARDED');
  });

  it('includes INTERNAL_ERROR', () => {
    expect(ONBOARDING_ERROR_CODES).toContain('INTERNAL_ERROR');
  });
});
