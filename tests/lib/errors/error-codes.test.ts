import { describe, it, expect } from 'vitest';
import { ERROR_CODES, ERROR_COPY, ERROR_CTA, isErrorCode } from '@/lib/errors/error-codes';

const EXPECTED_NEW = [
  'INSUFFICIENT_TOKENS',
  'GROUNDING_FAILED',
  'INTERNAL_ERROR',
  'HAPCARD_NOT_FOUND',
  'USER_CHART_NOT_FOUND',
  'REPLAY_DURING_OUTAGE',
] as const;

// pay-per-use 전환(ADR-039): 사용 시점 즉시결제 코드
const PAY_PER_USE_CODES = ['PAYMENT_REQUIRED', 'RATE_LIMITED'] as const;

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

  it('pay-per-use 코드(PAYMENT_REQUIRED·RATE_LIMITED)를 포함하고 한국어 copy 가 있다', () => {
    for (const code of PAY_PER_USE_CODES) {
      expect(ERROR_CODES).toContain(code);
      expect(isErrorCode(code)).toBe(true);
      expect((ERROR_COPY as Record<string, string>)[code].length).toBeGreaterThan(5);
    }
  });

  it('토큰 부족 CTA는 충전 페이지로 연결한다 (Phase 5/6에서 결제 시트로 전환 예정)', () => {
    expect(ERROR_CTA.INSUFFICIENT_TOKENS).toEqual({
      label: '충전하러 가기',
      href: '/payments/charge',
    });
  });
});
