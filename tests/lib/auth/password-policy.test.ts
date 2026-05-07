import { describe, expect, test } from 'vitest';
import { validatePassword } from '@/lib/auth/password-policy';

describe('validatePassword', () => {
  test('rejects passwords shorter than 8 chars', () => {
    expect(validatePassword('test123')).toEqual({ valid: false, code: 'tooShort' });
  });

  test('rejects letters-only 8-char passwords', () => {
    expect(validatePassword('abcdefgh')).toEqual({ valid: false, code: 'missingClasses' });
  });

  test('rejects digits-only 8-char passwords', () => {
    expect(validatePassword('12345678')).toEqual({ valid: false, code: 'missingClasses' });
  });

  test('accepts 8-char letters + digits (matches seed password test1234)', () => {
    expect(validatePassword('test1234')).toEqual({ valid: true });
  });

  test('accepts mixed-case letters + digits', () => {
    expect(validatePassword('Test1234')).toEqual({ valid: true });
  });

  test('accepts very long passwords', () => {
    expect(validatePassword('a'.repeat(100) + '1')).toEqual({ valid: true });
  });
});
