import { describe, expect, it } from 'vitest';
import { toErrorMessage } from '@/lib/errors/to-message';

describe('toErrorMessage', () => {
  it('returns err.message when err is an Error', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns default fallback for non-Error', () => {
    expect(toErrorMessage('string error')).toBe('unknown error');
    expect(toErrorMessage(42)).toBe('unknown error');
    expect(toErrorMessage(null)).toBe('unknown error');
    expect(toErrorMessage(undefined)).toBe('unknown error');
  });

  it('uses custom fallback for non-Error', () => {
    expect(toErrorMessage({ code: 1 }, 'custom fallback')).toBe('custom fallback');
  });

  it('String(err) as fallback preserves non-Error stringification', () => {
    const obj = { toString: () => 'custom obj' };
    expect(toErrorMessage(obj, String(obj))).toBe('custom obj');
  });
});
