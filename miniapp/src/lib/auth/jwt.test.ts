import { describe, expect, it } from 'vitest';

import { isJwtExpired } from './jwt';

/** 테스트용 최소 JWT 생성 (header.payload.sig). payload 는 base64url. */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

describe('isJwtExpired', () => {
  it('미래 exp → false (유효)', () => {
    expect(isJwtExpired(makeJwt({ exp: nowSec() + 3600 }))).toBe(false);
  });

  it('과거 exp → true (만료)', () => {
    expect(isJwtExpired(makeJwt({ exp: nowSec() - 10 }))).toBe(true);
  });

  it('만료 임박(skew 여유 안) → true', () => {
    // exp 가 30초 후지만 기본 skew 60초 안이라 미리 만료 취급
    expect(isJwtExpired(makeJwt({ exp: nowSec() + 30 }), 60)).toBe(true);
  });

  it('skew 0 이면 30초 후 토큰은 아직 유효', () => {
    expect(isJwtExpired(makeJwt({ exp: nowSec() + 30 }), 0)).toBe(false);
  });

  it('exp 부재 → true (사용 불가 취급)', () => {
    expect(isJwtExpired(makeJwt({ sub: 'u1' }))).toBe(true);
  });

  it('null/빈문자/형식오류 → true', () => {
    expect(isJwtExpired(null)).toBe(true);
    expect(isJwtExpired(undefined)).toBe(true);
    expect(isJwtExpired('')).toBe(true);
    expect(isJwtExpired('not-a-jwt')).toBe(true);
    expect(isJwtExpired('only.two')).toBe(true);
  });

  it('payload 디코드/파싱 불가 → true', () => {
    expect(isJwtExpired('h.@@@.s')).toBe(true);
  });
});
