/**
 * /api/toss/login route 단위 테스트.
 *
 * toss/login 모듈과 session 모듈을 mock 해 네트워크 없이 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/toss/login');
vi.mock('@/lib/toss/session');

import { POST } from '@/app/api/toss/login/route';
import { exchangeAuthCode, fetchLoginMe } from '@/lib/toss/login';
import { findOrCreateSupabaseUserForTossUserKey } from '@/lib/toss/session';
import type { TossTokenSuccess, TossLoginMeSuccess, TossApiError } from '@/types/toss';

// ---------------------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------------------

const MOCK_TOSS_TOKEN: TossTokenSuccess = {
  tokenType: 'bearer',
  accessToken: 'toss-access-xxx',
  refreshToken: 'toss-refresh-yyy',
  expiresIn: 3599,
  scope: 'user_key',
};

const MOCK_LOGIN_ME: TossLoginMeSuccess = {
  userKey: 443731103,
  scope: 'user_key',
  agreedTerms: [],
};

const MOCK_SESSION = {
  access_token: 'sb-access-token',
  refresh_token: 'sb-refresh-token',
  expires_at: 1750000000,
  user_id: 'user-uuid-001',
};

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/toss/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function throwTossApiError(errorCode: string): never {
  const err: TossApiError = { kind: 'toss_api_error', errorCode };
  throw err;
}

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exchangeAuthCode).mockResolvedValue(MOCK_TOSS_TOKEN);
  vi.mocked(fetchLoginMe).mockResolvedValue(MOCK_LOGIN_ME);
  vi.mocked(findOrCreateSupabaseUserForTossUserKey).mockResolvedValue(MOCK_SESSION);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/toss/login', () => {
  describe('정상 흐름', () => {
    it('authorizationCode + referrer 로 Supabase 세션을 반환한다', async () => {
      const res = await POST(makeRequest({
        authorizationCode: 'auth-code-abc',
        referrer: 'DEFAULT',
      }));

      expect(res.status).toBe(200);
      const body = await res.json() as { access_token: string; refresh_token: string; expires_at: number };
      expect(body.access_token).toBe('sb-access-token');
      expect(body.refresh_token).toBe('sb-refresh-token');
      expect(body.expires_at).toBe(1750000000);
    });

    it('SANDBOX referrer 도 허용한다', async () => {
      const res = await POST(makeRequest({
        authorizationCode: 'sandbox-code',
        referrer: 'SANDBOX',
      }));
      expect(res.status).toBe(200);
    });

    it('exchangeAuthCode 에 올바른 인수를 전달한다', async () => {
      await POST(makeRequest({
        authorizationCode: 'code-xyz',
        referrer: 'DEFAULT',
      }));

      expect(exchangeAuthCode).toHaveBeenCalledWith({
        authorizationCode: 'code-xyz',
        referrer: 'DEFAULT',
      });
    });

    it('fetchLoginMe 에 toss accessToken 을 전달한다', async () => {
      await POST(makeRequest({
        authorizationCode: 'code-xyz',
        referrer: 'DEFAULT',
      }));

      expect(fetchLoginMe).toHaveBeenCalledWith('toss-access-xxx');
    });

    it('findOrCreateSupabaseUserForTossUserKey 에 userKey 를 전달한다', async () => {
      await POST(makeRequest({
        authorizationCode: 'code-xyz',
        referrer: 'DEFAULT',
      }));

      expect(findOrCreateSupabaseUserForTossUserKey).toHaveBeenCalledWith(443731103);
    });
  });

  describe('요청 유효성 검증', () => {
    it('authorizationCode 누락 시 400 반환', async () => {
      const res = await POST(makeRequest({ referrer: 'DEFAULT' }));
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_BODY');
    });

    it('referrer 누락 시 400 반환', async () => {
      const res = await POST(makeRequest({ authorizationCode: 'code' }));
      expect(res.status).toBe(400);
    });

    it('잘못된 referrer 값 시 400 반환', async () => {
      const res = await POST(makeRequest({
        authorizationCode: 'code',
        referrer: 'INVALID',
      }));
      expect(res.status).toBe(400);
    });

    it('빈 바디 시 400 반환', async () => {
      const req = new Request('http://localhost/api/toss/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Toss API 에러 매핑', () => {
    it('invalid_grant 시 400 반환', async () => {
      vi.mocked(exchangeAuthCode).mockImplementation(() =>
        throwTossApiError('invalid_grant'),
      );

      const res = await POST(makeRequest({
        authorizationCode: 'expired-code',
        referrer: 'DEFAULT',
      }));

      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_BODY');
    });

    it('USER_NOT_FOUND 시 401 반환', async () => {
      vi.mocked(fetchLoginMe).mockImplementation(() =>
        throwTossApiError('USER_NOT_FOUND'),
      );

      const res = await POST(makeRequest({
        authorizationCode: 'code',
        referrer: 'DEFAULT',
      }));

      expect(res.status).toBe(401);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('USER_KEY_NOT_FOUND 시 401 반환', async () => {
      vi.mocked(fetchLoginMe).mockImplementation(() =>
        throwTossApiError('USER_KEY_NOT_FOUND'),
      );

      const res = await POST(makeRequest({
        authorizationCode: 'code',
        referrer: 'DEFAULT',
      }));

      expect(res.status).toBe(401);
    });

    it('기타 Toss API 에러 시 502 반환', async () => {
      vi.mocked(exchangeAuthCode).mockImplementation(() =>
        throwTossApiError('INTERNAL_ERROR'),
      );

      const res = await POST(makeRequest({
        authorizationCode: 'code',
        referrer: 'DEFAULT',
      }));

      expect(res.status).toBe(502);
    });
  });

  describe('세션 민팅 오류', () => {
    it('findOrCreate 오류 시 500 반환', async () => {
      vi.mocked(findOrCreateSupabaseUserForTossUserKey).mockRejectedValue(
        new Error('Supabase signInWithPassword 실패'),
      );

      const res = await POST(makeRequest({
        authorizationCode: 'code',
        referrer: 'DEFAULT',
      }));

      expect(res.status).toBe(500);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
