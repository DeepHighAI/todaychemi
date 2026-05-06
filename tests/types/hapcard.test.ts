import { describe, it, expect } from 'vitest';
import { HapcardRequestSchema, HAPCARD_ERROR_CODES } from '@/types/hapcard';

const validBody = {
  relation_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  mode: '일합',
  theory_profile_version: 'v0.2',
};

describe('HapcardRequestSchema', () => {
  it('parses a valid body without optional question_slot', () => {
    const result = HapcardRequestSchema.safeParse(validBody);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.relation_id).toBe(validBody.relation_id);
    expect(result.data.mode).toBe('일합');
  });

  it('parses a valid body with optional question_slot', () => {
    const result = HapcardRequestSchema.safeParse({
      ...validBody,
      question_slot: '이 사람과 협업이 잘 될까요?',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.question_slot).toBe('이 사람과 협업이 잘 될까요?');
  });

  it('rejects body with missing relation_id', () => {
    const bad = structuredClone(validBody);
    delete (bad as any).relation_id;
    expect(HapcardRequestSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects body where relation_id is not a UUID', () => {
    const result = HapcardRequestSchema.safeParse({
      ...validBody,
      relation_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects body where mode is outside the 6-mode enum', () => {
    const result = HapcardRequestSchema.safeParse({
      ...validBody,
      mode: '알수없는모드',
    });
    expect(result.success).toBe(false);
  });

  it('rejects body where theory_profile_version is an empty string', () => {
    const result = HapcardRequestSchema.safeParse({
      ...validBody,
      theory_profile_version: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects body with extra field — PII 가드 (.strict())', () => {
    const result = HapcardRequestSchema.safeParse({
      ...validBody,
      birth_date: '1990-01-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('HAPCARD_ERROR_CODES', () => {
  it('contains all 8 error codes', () => {
    expect(HAPCARD_ERROR_CODES).toHaveLength(8);
  });

  it('includes INVALID_BODY', () => {
    expect(HAPCARD_ERROR_CODES).toContain('INVALID_BODY');
  });

  it('includes UNAUTHORIZED', () => {
    expect(HAPCARD_ERROR_CODES).toContain('UNAUTHORIZED');
  });

  it('includes USER_CHART_LOOKUP_FAILED', () => {
    expect(HAPCARD_ERROR_CODES).toContain('USER_CHART_LOOKUP_FAILED');
  });

  it('includes USER_CHART_NOT_FOUND', () => {
    expect(HAPCARD_ERROR_CODES).toContain('USER_CHART_NOT_FOUND');
  });

  it('includes RELATION_CHART_LOOKUP_FAILED', () => {
    expect(HAPCARD_ERROR_CODES).toContain('RELATION_CHART_LOOKUP_FAILED');
  });

  it('includes RELATION_CHART_NOT_FOUND', () => {
    expect(HAPCARD_ERROR_CODES).toContain('RELATION_CHART_NOT_FOUND');
  });

  it('includes GROUNDING_FAILED', () => {
    expect(HAPCARD_ERROR_CODES).toContain('GROUNDING_FAILED');
  });

  it('includes INTERNAL_ERROR', () => {
    expect(HAPCARD_ERROR_CODES).toContain('INTERNAL_ERROR');
  });
});
