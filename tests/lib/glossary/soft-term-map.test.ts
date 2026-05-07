import { describe, it, expect } from 'vitest';
import {
  SOFT_TO_CLASSICAL,
  CLASSICAL_TO_SOFT,
  toClassicalKey,
} from '@/lib/glossary/soft-term-map';

describe('SOFT_TO_CLASSICAL', () => {
  it('maps 끌림 → 합', () => expect(SOFT_TO_CLASSICAL['끌림']).toBe('합'));
  it('maps 긴장 → 형', () => expect(SOFT_TO_CLASSICAL['긴장']).toBe('형'));
  it('maps 부딪힘 → 충', () => expect(SOFT_TO_CLASSICAL['부딪힘']).toBe('충'));
  it('maps 소모 → 해', () => expect(SOFT_TO_CLASSICAL['소모']).toBe('해'));
});

describe('CLASSICAL_TO_SOFT', () => {
  it('maps 합 → 끌림', () => expect(CLASSICAL_TO_SOFT['합']).toBe('끌림'));
  it('maps 형 → 긴장', () => expect(CLASSICAL_TO_SOFT['형']).toBe('긴장'));
  it('maps 충 → 부딪힘', () => expect(CLASSICAL_TO_SOFT['충']).toBe('부딪힘'));
  it('maps 해 → 소모', () => expect(CLASSICAL_TO_SOFT['해']).toBe('소모'));
});

describe('toClassicalKey', () => {
  it('is idempotent for classical tokens', () => {
    expect(toClassicalKey('합')).toBe('합');
    expect(toClassicalKey('형')).toBe('형');
    expect(toClassicalKey('충')).toBe('충');
    expect(toClassicalKey('해')).toBe('해');
  });

  it('converts soft tokens to classical', () => {
    expect(toClassicalKey('끌림')).toBe('합');
    expect(toClassicalKey('긴장')).toBe('형');
    expect(toClassicalKey('부딪힘')).toBe('충');
    expect(toClassicalKey('소모')).toBe('해');
  });

  it('returns non-mapped tokens unchanged (일주, 십신)', () => {
    expect(toClassicalKey('일주')).toBe('일주');
    expect(toClassicalKey('십신')).toBe('십신');
  });
});
