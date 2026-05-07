export type PasswordPolicyError = 'tooShort' | 'missingClasses';
export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; code: PasswordPolicyError };

const MIN_LENGTH = 8;
const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /[0-9]/;

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < MIN_LENGTH) return { valid: false, code: 'tooShort' };
  if (!HAS_LETTER.test(password) || !HAS_DIGIT.test(password)) {
    return { valid: false, code: 'missingClasses' };
  }
  return { valid: true };
}
