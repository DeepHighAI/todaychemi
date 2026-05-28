import { describe, expect, it } from 'vitest';
import {
  MEMO_BODY_MAX,
  MemoCreateSchema,
  MemoUpdateSchema,
  MEMO_ERROR_CODES,
} from '@/types/memo';

describe('MEMO_BODY_MAX', () => {
  it('80 이어야 함', () => {
    expect(MEMO_BODY_MAX).toBe(80);
  });
});

describe('MemoCreateSchema', () => {
  it('1자 body — 통과', () => {
    expect(MemoCreateSchema.safeParse({ body: 'a' }).success).toBe(true);
  });

  it('80자 body — 통과', () => {
    expect(MemoCreateSchema.safeParse({ body: 'a'.repeat(80) }).success).toBe(true);
  });

  it('81자 body — 실패', () => {
    expect(MemoCreateSchema.safeParse({ body: 'a'.repeat(81) }).success).toBe(false);
  });

  it('빈 문자열 — 실패', () => {
    expect(MemoCreateSchema.safeParse({ body: '' }).success).toBe(false);
  });

  it('공백만 — trim 후 empty → 실패', () => {
    expect(MemoCreateSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('trim 후 1자 — 통과', () => {
    const result = MemoCreateSchema.safeParse({ body: ' a ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body).toBe('a');
  });

  it('extra 필드 — strict() 위반 → 실패', () => {
    expect(MemoCreateSchema.safeParse({ body: 'hello', extra: 'x' }).success).toBe(false);
  });

  it('body 없음 — 실패', () => {
    expect(MemoCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe('MemoUpdateSchema', () => {
  it('1자 body — 통과', () => {
    expect(MemoUpdateSchema.safeParse({ body: 'b' }).success).toBe(true);
  });

  it('81자 body — 실패', () => {
    expect(MemoUpdateSchema.safeParse({ body: 'b'.repeat(81) }).success).toBe(false);
  });

  it('extra 필드 — strict() 위반 → 실패', () => {
    expect(MemoUpdateSchema.safeParse({ body: 'b', extra: 'y' }).success).toBe(false);
  });
});

describe('MEMO_ERROR_CODES', () => {
  it('5가지 코드 포함', () => {
    expect(MEMO_ERROR_CODES).toContain('INVALID_BODY');
    expect(MEMO_ERROR_CODES).toContain('UNAUTHORIZED');
    expect(MEMO_ERROR_CODES).toContain('MEMO_NOT_FOUND');
    expect(MEMO_ERROR_CODES).toContain('RELATION_NOT_FOUND');
    expect(MEMO_ERROR_CODES).toContain('INTERNAL_ERROR');
  });
});
