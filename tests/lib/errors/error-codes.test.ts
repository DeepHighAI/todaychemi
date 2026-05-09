import { describe, it, expect } from 'vitest';
import { ERROR_CODES, ERROR_COPY } from '@/lib/errors/error-codes';

const EXPECTED_NEW = [
  'INSUFFICIENT_TOKENS',
  'GROUNDING_FAILED',
  'INTERNAL_ERROR',
  'HAPCARD_NOT_FOUND',
  'USER_CHART_NOT_FOUND',
  'REPLAY_DURING_OUTAGE',
] as const;

describe('ERROR_CODES 카탈로그', () => {
  it('백엔드 라우트 6개 신규 코드를 포함한다', () => {
    for (const code of EXPECTED_NEW) {
      expect(ERROR_CODES).toContain(code);
    }
  });

  it('ERROR_COPY 에 6개 신규 코드 한국어 메시지가 있다', () => {
    for (const code of EXPECTED_NEW) {
      expect(ERROR_COPY).toHaveProperty(code);
      expect(typeof (ERROR_COPY as Record<string, string>)[code]).toBe('string');
      expect((ERROR_COPY as Record<string, string>)[code].length).toBeGreaterThan(5);
    }
  });
});
