import { describe, it, expect } from 'vitest';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';

describe('DEFAULT_THEORY_PROFILE_VERSION', () => {
  it('equals v2 (ADR-021 Amended — 시주 진태양시 보정)', () => {
    expect(DEFAULT_THEORY_PROFILE_VERSION).toBe('v2');
  });

  it('is a string', () => {
    expect(typeof DEFAULT_THEORY_PROFILE_VERSION).toBe('string');
  });
});
