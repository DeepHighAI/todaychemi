import { describe, it, expect } from 'vitest';
import { DAILY_HAP_ERROR_CODES } from '@/types/dailyHap';

describe('DAILY_HAP_ERROR_CODES', () => {
  it('3개 코드', () => {
    expect(DAILY_HAP_ERROR_CODES).toHaveLength(3);
  });

  it('UNAUTHORIZED 포함', () => {
    expect(DAILY_HAP_ERROR_CODES).toContain('UNAUTHORIZED');
  });

  it('CHART_NOT_FOUND 포함', () => {
    expect(DAILY_HAP_ERROR_CODES).toContain('CHART_NOT_FOUND');
  });

  it('INTERNAL_ERROR 포함', () => {
    expect(DAILY_HAP_ERROR_CODES).toContain('INTERNAL_ERROR');
  });
});
