import { describe, it, expect } from 'vitest';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';

describe('DEFAULT_THEORY_PROFILE_VERSION', () => {
  it('equals v1', () => {
    expect(DEFAULT_THEORY_PROFILE_VERSION).toBe('v1');
  });

  it('is a string', () => {
    expect(typeof DEFAULT_THEORY_PROFILE_VERSION).toBe('string');
  });
});
