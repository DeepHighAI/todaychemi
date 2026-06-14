/**
 * src/lib/toss/cors.ts 단위 테스트.
 *
 * CORS 허용 오리진 파싱, 헤더 빌드, preflight 판별 세 가지를 검증한다.
 * 네트워크 없이 순수 함수 테스트.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCorsHeaders,
  getAllowedTossOrigins,
  isTossPreflightRequest,
} from '@/lib/toss/cors';

// ---------------------------------------------------------------------------
// getAllowedTossOrigins
// ---------------------------------------------------------------------------

describe('getAllowedTossOrigins', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('TOSS_ALLOWED_ORIGINS 미설정 시 기본 오리진 2개 반환', () => {
    vi.stubEnv('TOSS_ALLOWED_ORIGINS', '');
    // 빈 문자열이면 filter(Boolean) 으로 빈 집합
    // 실제 미설정(undefined)과 구분하기 위해 undefined 테스트
    vi.unstubAllEnvs();
    const origins = getAllowedTossOrigins();
    expect(origins.has('https://todaychemi.apps.tossmini.com')).toBe(true);
    expect(origins.has('https://todaychemi.private-apps.tossmini.com')).toBe(true);
  });

  it('TOSS_ALLOWED_ORIGINS 환경변수로 커스텀 오리진 설정', () => {
    vi.stubEnv('TOSS_ALLOWED_ORIGINS', 'https://custom.apps.tossmini.com, https://custom.private-apps.tossmini.com ');
    const origins = getAllowedTossOrigins();
    expect(origins.has('https://custom.apps.tossmini.com')).toBe(true);
    expect(origins.has('https://custom.private-apps.tossmini.com')).toBe(true);
    // 기본값은 포함되지 않음
    expect(origins.has('https://todaychemi.apps.tossmini.com')).toBe(false);
  });

  it('오리진 비교는 대소문자 무시', () => {
    vi.stubEnv('TOSS_ALLOWED_ORIGINS', 'https://TODAYCHEMI.apps.tossmini.com');
    const origins = getAllowedTossOrigins();
    // 소문자로 정규화됨
    expect(origins.has('https://todaychemi.apps.tossmini.com')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildCorsHeaders
// ---------------------------------------------------------------------------

describe('buildCorsHeaders', () => {
  beforeEach(() => {
    vi.stubEnv(
      'TOSS_ALLOWED_ORIGINS',
      'https://todaychemi.apps.tossmini.com,https://todaychemi.private-apps.tossmini.com',
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('허용 오리진이면 올바른 CORS 헤더 반환', () => {
    const headers = buildCorsHeaders('https://todaychemi.apps.tossmini.com');
    expect(headers).toBeDefined();
    expect(headers!['Access-Control-Allow-Origin']).toBe('https://todaychemi.apps.tossmini.com');
    expect(headers!['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers!['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers!['Access-Control-Allow-Headers']).toContain('Authorization');
    expect(headers!['Vary']).toBe('Origin');
  });

  it('private-apps 오리진도 허용', () => {
    const headers = buildCorsHeaders('https://todaychemi.private-apps.tossmini.com');
    expect(headers).toBeDefined();
    expect(headers!['Access-Control-Allow-Origin']).toBe('https://todaychemi.private-apps.tossmini.com');
  });

  it('Origin 에코 — 와일드카드(*) 사용 안 함', () => {
    const origin = 'https://todaychemi.apps.tossmini.com';
    const headers = buildCorsHeaders(origin);
    expect(headers!['Access-Control-Allow-Origin']).toBe(origin);
    expect(headers!['Access-Control-Allow-Origin']).not.toBe('*');
  });

  it('허용 목록에 없는 오리진이면 undefined 반환 (헤더 없음)', () => {
    const headers = buildCorsHeaders('https://evil.example.com');
    expect(headers).toBeUndefined();
  });

  it('Origin 헤더 없음(null) 이면 undefined 반환 (동일 오리진 요청)', () => {
    const headers = buildCorsHeaders(null);
    expect(headers).toBeUndefined();
  });

  it('오리진 비교는 대소문자 무시', () => {
    const headers = buildCorsHeaders('https://TODAYCHEMI.apps.tossmini.com');
    expect(headers).toBeDefined();
    // 에코는 원본 문자열 그대로
    expect(headers!['Access-Control-Allow-Origin']).toBe('https://TODAYCHEMI.apps.tossmini.com');
  });
});

// ---------------------------------------------------------------------------
// isTossPreflightRequest
// ---------------------------------------------------------------------------

describe('isTossPreflightRequest', () => {
  beforeEach(() => {
    vi.stubEnv(
      'TOSS_ALLOWED_ORIGINS',
      'https://todaychemi.apps.tossmini.com,https://todaychemi.private-apps.tossmini.com',
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeReq(method: string, origin: string | null) {
    return {
      method,
      headers: { get: (name: string) => name === 'origin' ? origin : null },
    };
  }

  it('OPTIONS + 허용 오리진이면 true', () => {
    expect(isTossPreflightRequest(makeReq('OPTIONS', 'https://todaychemi.apps.tossmini.com'))).toBe(true);
  });

  it('OPTIONS + private-apps 허용 오리진이면 true', () => {
    expect(isTossPreflightRequest(makeReq('OPTIONS', 'https://todaychemi.private-apps.tossmini.com'))).toBe(true);
  });

  it('GET + 허용 오리진이면 false (OPTIONS 아님)', () => {
    expect(isTossPreflightRequest(makeReq('GET', 'https://todaychemi.apps.tossmini.com'))).toBe(false);
  });

  it('OPTIONS + 허용 안 된 오리진이면 false', () => {
    expect(isTossPreflightRequest(makeReq('OPTIONS', 'https://evil.example.com'))).toBe(false);
  });

  it('OPTIONS + Origin 없으면 false (동일 오리진 preflight)', () => {
    expect(isTossPreflightRequest(makeReq('OPTIONS', null))).toBe(false);
  });
});
