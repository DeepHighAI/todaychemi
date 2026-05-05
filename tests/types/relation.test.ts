import { describe, expect, it } from 'vitest';

import {
  RELATION_ERROR_CODES,
  RelationCreateSchema,
} from '@/types/relation';

describe('RELATION_ERROR_CODES', () => {
  it('contains INVALID_BODY', () => {
    expect(RELATION_ERROR_CODES).toContain('INVALID_BODY');
  });

  it('contains UNAUTHORIZED', () => {
    expect(RELATION_ERROR_CODES).toContain('UNAUTHORIZED');
  });

  it('contains INTERNAL_ERROR', () => {
    expect(RELATION_ERROR_CODES).toContain('INTERNAL_ERROR');
  });

  it('has exactly 3 codes', () => {
    expect(RELATION_ERROR_CODES).toHaveLength(3);
  });
});

describe('RelationCreateSchema', () => {
  const VALID = {
    nickname: '봄달',
    mode: '친구합',
    gender: 'F',
    birth_date: '1995-07-20',
    birth_date_calendar: 'solar',
    is_lunar_leap: false,
    birth_time_knowledge: 'exact',
    birth_time: '09:00',
    consent_confirmed: true,
    is_primary: false,
  };

  it('parses a valid relation body', () => {
    const result = RelationCreateSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it('rejects unknown mode', () => {
    const result = RelationCreateSchema.safeParse({ ...VALID, mode: '사랑합' });
    expect(result.success).toBe(false);
  });

  it('rejects empty nickname', () => {
    const result = RelationCreateSchema.safeParse({ ...VALID, nickname: '' });
    expect(result.success).toBe(false);
  });

  it('rejects nickname longer than 20 chars', () => {
    const result = RelationCreateSchema.safeParse({ ...VALID, nickname: 'a'.repeat(21) });
    expect(result.success).toBe(false);
  });

  it('rejects birth_place extra field (PII strict guard)', () => {
    const result = RelationCreateSchema.safeParse({ ...VALID, birth_place: '서울' });
    expect(result.success).toBe(false);
  });

  it('accepts null birth_time with unknown knowledge', () => {
    const result = RelationCreateSchema.safeParse({
      ...VALID,
      birth_time_knowledge: 'unknown',
      birth_time: null,
    });
    expect(result.success).toBe(true);
  });

  it('defaults is_lunar_leap to false when omitted', () => {
    const { is_lunar_leap: _omit, ...without } = VALID;
    const result = RelationCreateSchema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_lunar_leap).toBe(false);
  });

  it('allows optional birth_longitude null', () => {
    const result = RelationCreateSchema.safeParse({ ...VALID, birth_longitude: null });
    expect(result.success).toBe(true);
  });
});
