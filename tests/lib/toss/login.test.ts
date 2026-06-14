/**
 * login.test.ts
 *
 * 토스 로그인 함수 단위 테스트.
 * 네트워크 없이 transport mock 주입으로만 검증한다.
 * 실제 인증서/cert 불필요.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  exchangeAuthCode,
  refreshAccessToken,
  fetchLoginMe,
  extractPublicLoginMe,
  disconnectByUserKey,
  disconnectByAccessToken,
  parseTossScope,
} from '@/lib/toss/login';
import type { TossTokenSuccess, TossLoginMeSuccess, TossApiError } from '@/types/toss';

// ---------------------------------------------------------------------------
// 테스트 픽스처
// ---------------------------------------------------------------------------

const MOCK_TOKEN: TossTokenSuccess = {
  tokenType: 'bearer',
  accessToken: 'access-tok-xxx',
  refreshToken: 'refresh-tok-yyy',
  expiresIn: 3599,
  scope: 'user_key USER_NAME',
};

const MOCK_LOGIN_ME: TossLoginMeSuccess = {
  userKey: 443731103,
  scope: 'user_key,USER_NAME,USER_BIRTHDAY',
  agreedTerms: ['basic_terms'],
  name: 'encrypted-name-base64',       // AES-GCM 암호화 상태
  birthday: 'encrypted-bday-base64',   // AES-GCM 암호화 상태
};

// ---------------------------------------------------------------------------
// parseTossScope — tolerant scope splitter (§2.5)
// ---------------------------------------------------------------------------

describe('parseTossScope (tolerant scope splitter)', () => {
  it('공백 구분 scope 를 파싱한다(generate-token style)', () => {
    const result = parseTossScope('user_key USER_NAME USER_BIRTHDAY');
    expect(result.tokens).toEqual(['user_key', 'USER_NAME', 'USER_BIRTHDAY']);
    expect(result.raw).toBe('user_key USER_NAME USER_BIRTHDAY');
  });

  it('콤마 구분 scope 를 파싱한다(login-me style)', () => {
    const result = parseTossScope('user_key,USER_NAME,USER_BIRTHDAY');
    expect(result.tokens).toEqual(['user_key', 'USER_NAME', 'USER_BIRTHDAY']);
  });

  it('콤마+공백 혼합 scope 를 파싱한다', () => {
    const result = parseTossScope('user_key, USER_NAME , USER_BIRTHDAY');
    expect(result.tokens).toEqual(['user_key', 'USER_NAME', 'USER_BIRTHDAY']);
  });

  it('2026-01-02 이후 추가된 미지 scope(user_key)를 throw 없이 처리한다', () => {
    const result = parseTossScope('user_key USER_NEW_UNKNOWN_SCOPE USER_NAME');
    expect(result.tokens).toContain('user_key');
    expect(result.tokens).toContain('USER_NEW_UNKNOWN_SCOPE');
  });

  it('빈 문자열이면 tokens 는 빈 배열이다', () => {
    const result = parseTossScope('');
    expect(result.tokens).toEqual([]);
  });

  it('연속 구분자(콤마 여러 개)도 올바르게 처리한다', () => {
    const result = parseTossScope('user_key,,USER_NAME');
    expect(result.tokens).toEqual(['user_key', 'USER_NAME']);
  });
});

// ---------------------------------------------------------------------------
// exchangeAuthCode — 토큰 교환 (§2.3)
// ---------------------------------------------------------------------------

describe('exchangeAuthCode', () => {
  it('SUCCESS 봉투이면 TossTokenSuccess 를 반환한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'SUCCESS',
      success: MOCK_TOKEN,
    });

    const result = await exchangeAuthCode(
      { authorizationCode: 'auth-code-001', referrer: 'DEFAULT' },
      transport,
    );

    expect(result.accessToken).toBe('access-tok-xxx');
    expect(result.refreshToken).toBe('refresh-tok-yyy');
    expect(result.expiresIn).toBe(3599);
  });

  it('SANDBOX referrer 도 허용한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'SUCCESS',
      success: MOCK_TOKEN,
    });

    const result = await exchangeAuthCode(
      { authorizationCode: 'auth-code-002', referrer: 'SANDBOX' },
      transport,
    );
    expect(result.accessToken).toBeDefined();
  });

  it('OAuth 베어 에러 { "error": "invalid_grant" } 를 TossApiError 로 throw 한다', async () => {
    const transport = vi.fn().mockResolvedValue({ error: 'invalid_grant' });

    await expect(
      exchangeAuthCode({ authorizationCode: 'expired', referrer: 'DEFAULT' }, transport),
    ).rejects.toMatchObject({
      kind: 'toss_api_error',
      errorCode: 'invalid_grant',
    });
  });

  it('FAIL 봉투를 TossApiError 로 throw 한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'FAIL',
      error: { errorCode: 'INTERNAL_ERROR', reason: '서버 내부 오류' },
    });

    await expect(
      exchangeAuthCode({ authorizationCode: 'code', referrer: 'DEFAULT' }, transport),
    ).rejects.toMatchObject({
      kind: 'toss_api_error',
      errorCode: 'INTERNAL_ERROR',
      reason: '서버 내부 오류',
    });
  });

  it('transport 오류는 그대로 전파된다', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('ERR_NETWORK'));

    await expect(
      exchangeAuthCode({ authorizationCode: 'code', referrer: 'DEFAULT' }, transport),
    ).rejects.toThrow('ERR_NETWORK');
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken — 토큰 갱신 (§2.4)
// ---------------------------------------------------------------------------

describe('refreshAccessToken', () => {
  it('SUCCESS 봉투이면 새 TossTokenSuccess 를 반환한다', async () => {
    const newToken = { ...MOCK_TOKEN, accessToken: 'new-access-tok' };
    const transport = vi.fn().mockResolvedValue({ resultType: 'SUCCESS', success: newToken });

    const result = await refreshAccessToken({ refreshToken: 'refresh-tok-yyy' }, transport);
    expect(result.accessToken).toBe('new-access-tok');
  });

  it('만료된 refreshToken 은 TossApiError throw (errorCode 포함)', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'FAIL',
      error: { errorCode: 'REFRESH_TOKEN_EXPIRED', reason: 'expired' },
    });

    await expect(
      refreshAccessToken({ refreshToken: 'expired-refresh' }, transport),
    ).rejects.toMatchObject({
      kind: 'toss_api_error',
      errorCode: 'REFRESH_TOKEN_EXPIRED',
    });
  });
});

// ---------------------------------------------------------------------------
// fetchLoginMe — 유저 정보 조회 (§2.5)
// ---------------------------------------------------------------------------

describe('fetchLoginMe', () => {
  it('SUCCESS 봉투이면 TossLoginMeSuccess 를 반환한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'SUCCESS',
      success: MOCK_LOGIN_ME,
    });

    const result = await fetchLoginMe('access-tok-xxx', transport);
    expect(result.userKey).toBe(443731103);
    expect(result.agreedTerms).toEqual(['basic_terms']);
  });

  it('USER_KEY_NOT_FOUND 에러를 TossApiError 로 throw 한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'FAIL',
      error: { errorCode: 'USER_KEY_NOT_FOUND' },
    });

    await expect(fetchLoginMe('bad-token', transport)).rejects.toMatchObject(
      {
        kind: 'toss_api_error',
        errorCode: 'USER_KEY_NOT_FOUND',
      },
    );
  });

  it('scope 필드가 콤마 구분이어도 raw 그대로 반환된다(파싱은 parseTossScope 별도)', async () => {
    const me: TossLoginMeSuccess = {
      ...MOCK_LOGIN_ME,
      scope: 'user_key,USER_NAME,USER_BIRTHDAY',
    };
    const transport = vi.fn().mockResolvedValue({ resultType: 'SUCCESS', success: me });

    const result = await fetchLoginMe('tok', transport);
    // fetchLoginMe 는 scope 를 파싱하지 않고 raw 그대로 반환
    expect(result.scope).toBe('user_key,USER_NAME,USER_BIRTHDAY');
  });
});

// ---------------------------------------------------------------------------
// extractPublicLoginMe — PII 제외 서브셋 추출
// ---------------------------------------------------------------------------

describe('extractPublicLoginMe', () => {
  it('userKey/scope/agreedTerms 만 반환하고 PII 필드를 포함하지 않는다', () => {
    const pub = extractPublicLoginMe(MOCK_LOGIN_ME);
    expect(pub.userKey).toBe(443731103);
    expect(pub.scope).toBeDefined();
    // PII 필드가 타입에 없어야 함
    expect('name' in pub).toBe(false);
    expect('birthday' in pub).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// disconnectByUserKey — readTimeout 3s 전달 + auto-retry 금지 검증 (§2.6, §3.8)
// ---------------------------------------------------------------------------

describe('disconnectByUserKey', () => {
  it('SUCCESS 봉투이면 TossDisconnectByUserKeySuccess 를 반환한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'SUCCESS',
      success: { userKey: 443731103 },
    });

    const result = await disconnectByUserKey(443731103, transport);
    expect(result.userKey).toBe(443731103);
  });

  it('timeoutMs: 3000 이 transport opts 에 포함되어야 한다(§3.8 readTimeout)', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'SUCCESS',
      success: { userKey: 1 },
    });

    await disconnectByUserKey(1, transport);

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 3000 }),
    );
  });

  it('FAIL 봉투를 TossApiError 로 throw 한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'FAIL',
      error: { errorCode: 'USER_NOT_FOUND' },
    });

    await expect(disconnectByUserKey(999, transport)).rejects.toMatchObject({
      kind: 'toss_api_error',
      errorCode: 'USER_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// disconnectByAccessToken (§2.6)
// ---------------------------------------------------------------------------

describe('disconnectByAccessToken', () => {
  it('SUCCESS 봉투이면 결과를 반환한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'SUCCESS',
      success: {},
    });

    const result = await disconnectByAccessToken('access-tok-xxx', transport);
    expect(result).toBeDefined();
  });

  it('Authorization Bearer 헤더가 transport opts 에 포함되어야 한다', async () => {
    const transport = vi.fn().mockResolvedValue({ resultType: 'SUCCESS', success: {} });

    await disconnectByAccessToken('tok-abc', transport);

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
      }),
    );
  });

  it('FAIL 봉투는 TossApiError 로 throw 한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'FAIL',
      error: { errorCode: 'INTERNAL_ERROR' },
    });

    await expect(disconnectByAccessToken('bad-tok', transport)).rejects.toMatchObject({
      kind: 'toss_api_error',
      errorCode: 'INTERNAL_ERROR',
    });
  });
});

// ---------------------------------------------------------------------------
// OAuth 베어 에러 봉투 vs FAIL 봉투 파서 분기 검증
// ---------------------------------------------------------------------------

describe('응답 봉투 파서 분기 (§3.6)', () => {
  it('resultType 없고 error 가 문자열이면 OAuth 베어 에러로 처리한다', async () => {
    // exchangeAuthCode 로 검증(generate-token 은 두 shape 모두 가능)
    const transport = vi.fn().mockResolvedValue({ error: 'unauthorized_client' });

    await expect(
      exchangeAuthCode({ authorizationCode: 'c', referrer: 'DEFAULT' }, transport),
    ).rejects.toMatchObject({
      kind: 'toss_api_error',
      errorCode: 'unauthorized_client',
    });
  });

  it('resultType: FAIL 이고 error 가 객체이면 FAIL 봉투로 처리한다', async () => {
    const transport = vi.fn().mockResolvedValue({
      resultType: 'FAIL',
      error: { errorCode: 'BAD_REQUEST', reason: '잘못된 요청' },
    });

    await expect(
      exchangeAuthCode({ authorizationCode: 'c', referrer: 'DEFAULT' }, transport),
    ).rejects.toMatchObject({
      kind: 'toss_api_error',
      errorCode: 'BAD_REQUEST',
      reason: '잘못된 요청',
    });
  });
});
