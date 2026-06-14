/**
 * login.ts
 *
 * Apps-in-Toss 토스 로그인 엔드포인트 타입드 래퍼.
 *
 * ⚠️ 이 모듈을 import 하는 Route Handler 는 반드시:
 *   export const runtime = 'nodejs';
 * 를 선언해야 한다(mTLS = Node 런타임 전용).
 *
 * 출처: 구현 레퍼런스 §2.3(generate-token), §2.4(refresh-token),
 *       §2.5(login-me), §2.6(disconnect), §3.6(응답 봉투), §3.8(타임아웃)
 */

import { mtlsRequest, TOSS_API_BASE_URL } from '@/lib/toss/mtls-client';
import type {
  MtlsTransport,
  TossApiError,
  TossEnvelope,
  TossGenerateTokenBody,
  TossLoginMeSuccess,
  TossLoginMePublic,
  TossParsedScope,
  TossRefreshTokenBody,
  TossTokenSuccess,
  TossDisconnectByUserKeySuccess,
  TossDisconnectByAccessTokenSuccess,
} from '@/types/toss';

// ---------------------------------------------------------------------------
// 응답 봉투 파서 (§3.6)
// ---------------------------------------------------------------------------

/**
 * 토스 API 응답 JSON 을 파싱해 성공 데이터 또는 구조화 에러를 반환한다.
 *
 * 처리하는 shape:
 *  1. OAuth 베어 에러: { "error": "invalid_grant" }  (resultType 없음)
 *  2. FAIL 봉투:      { "resultType": "FAIL", "error": { "errorCode": "...", ... } }
 *  3. SUCCESS 봉투:   { "resultType": "SUCCESS", "success": { ... } }
 *
 * 실패는 TossApiError 를 throw 한다.
 */
function parseEnvelope<T>(raw: unknown): T {
  const envelope = raw as TossEnvelope<T>;

  // Shape 1: OAuth 베어 에러 ({ "error": "invalid_grant" })
  // resultType 이 없고 error 가 문자열인 경우
  if (
    typeof envelope === 'object' &&
    envelope !== null &&
    !('resultType' in envelope) &&
    'error' in envelope &&
    typeof (envelope as { error: unknown }).error === 'string'
  ) {
    const err: TossApiError = {
      kind: 'toss_api_error',
      errorCode: (envelope as { error: string }).error,
    };
    throw err;
  }

  // Shape 2 + 3: resultType 봉투
  if (
    typeof envelope === 'object' &&
    envelope !== null &&
    'resultType' in envelope
  ) {
    if (envelope.resultType === 'FAIL') {
      const fail = envelope as { resultType: 'FAIL'; error: { errorCode: string; reason?: string } };
      const err: TossApiError = {
        kind: 'toss_api_error',
        errorCode: fail.error?.errorCode ?? 'UNKNOWN',
        reason: fail.error?.reason,
      };
      throw err;
    }

    if (envelope.resultType === 'SUCCESS') {
      return (envelope as { resultType: 'SUCCESS'; success: T }).success;
    }
  }

  // 알 수 없는 shape — 그대로 반환(호출자가 처리)
  return raw as T;
}

// ---------------------------------------------------------------------------
// scope tolerant splitter (§2.5)
// ---------------------------------------------------------------------------

/**
 * 토스 scope 문자열을 파싱한다.
 *
 * 구분자 이중성(§2.5 명시): generate-token 응답은 공백 구분, login-me 응답은 콤마 구분.
 * 2026-01-02 이후 "user_key" scope 가 추가되므로 미지 토큰도 허용해야 한다.
 * 콤마 + 공백 모두 분리 후 빈 토큰 제거.
 */
export function parseTossScope(scope: string): TossParsedScope {
  const tokens = scope
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return { raw: scope, tokens };
}

// ---------------------------------------------------------------------------
// 1. exchangeAuthCode — 토큰 교환 (§2.3)
// ---------------------------------------------------------------------------

/**
 * `appLogin()` 반환값(authorizationCode, referrer)을 서버에서 accessToken/refreshToken 으로 교환한다.
 *
 * - authorizationCode 유효 10분, 일회성(재사용 시 invalid_grant).
 * - 성공: TossTokenSuccess 반환.
 * - 실패: TossApiError throw (errorCode: "invalid_grant" 등).
 */
export async function exchangeAuthCode(
  body: TossGenerateTokenBody,
  transport?: MtlsTransport,
): Promise<TossTokenSuccess> {
  const raw = await mtlsRequest(
    {
      baseUrl: TOSS_API_BASE_URL,
      method: 'POST',
      path: '/api-partner/v1/apps-in-toss/user/oauth2/generate-token',
      body,
    },
    transport,
  );
  return parseEnvelope<TossTokenSuccess>(raw);
}

// ---------------------------------------------------------------------------
// 2. refreshAccessToken — 토큰 갱신 (§2.4)
// ---------------------------------------------------------------------------

/**
 * refreshToken 으로 새 accessToken 을 발급받는다.
 *
 * - refreshToken 유효 14일. 만료 시 appLogin() 재실행 필요.
 * - 실패: TossApiError throw.
 */
export async function refreshAccessToken(
  body: TossRefreshTokenBody,
  transport?: MtlsTransport,
): Promise<TossTokenSuccess> {
  const raw = await mtlsRequest(
    {
      baseUrl: TOSS_API_BASE_URL,
      method: 'POST',
      path: '/api-partner/v1/apps-in-toss/user/oauth2/refresh-token',
      body,
    },
    transport,
  );
  return parseEnvelope<TossTokenSuccess>(raw);
}

// ---------------------------------------------------------------------------
// 3. fetchLoginMe — 유저 정보 조회 (§2.5)
// ---------------------------------------------------------------------------

/**
 * accessToken 으로 userKey 및 동의 scope 를 조회한다.
 *
 * PII 필드(name/birthday/gender 등)는 AES-256-GCM 암호화 상태로 반환됨.
 * 복호화는 별도 레이어에서 처리 — 이 함수는 raw TossLoginMeSuccess 만 반환.
 * ZDR 경계(CLAUDE.md §5): LLM 페이로드에 PII 필드 진입 금지.
 *
 * @returns TossLoginMeSuccess — 전체 raw 응답(암호화 PII 포함).
 *          userKey 만 필요하면 반환값에서 TossLoginMePublic 필드만 사용할 것.
 */
export async function fetchLoginMe(
  accessToken: string,
  transport?: MtlsTransport,
): Promise<TossLoginMeSuccess> {
  const raw = await mtlsRequest(
    {
      baseUrl: TOSS_API_BASE_URL,
      method: 'GET',
      path: '/api-partner/v1/apps-in-toss/user/oauth2/login-me',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    transport,
  );
  return parseEnvelope<TossLoginMeSuccess>(raw);
}

/**
 * fetchLoginMe 결과에서 PII 를 제외한 안전 서브셋만 추출한다.
 * 서버 내부에서 userKey 만 필요할 때 사용.
 */
export function extractPublicLoginMe(me: TossLoginMeSuccess): TossLoginMePublic {
  return {
    userKey: me.userKey,
    scope: me.scope,
    agreedTerms: me.agreedTerms,
  };
}

// ---------------------------------------------------------------------------
// 4. disconnectByUserKey — 서비스 발화 연결 끊기 (§2.6)
// ---------------------------------------------------------------------------

/**
 * 서버에서 userKey 로 토스 로그인 연결을 끊는다.
 *
 * ⚠️ readTimeout 3초 적용 — auto-retry 금지(§3.8).
 *    userKey 에 accessToken 이 여러 개인 경우 타임아웃이 발생할 수 있다.
 *    일정 시간 후 재시도는 허용되나 즉시 retry 는 금지.
 * ⚠️ 이 호출 시 사용자 발화 콜백(§2.7)은 발화되지 않는다.
 */
export async function disconnectByUserKey(
  userKey: number,
  transport?: MtlsTransport,
): Promise<TossDisconnectByUserKeySuccess> {
  const raw = await mtlsRequest(
    {
      baseUrl: TOSS_API_BASE_URL,
      method: 'POST',
      path: '/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-user-key',
      body: { userKey },
      // readTimeout 3s — userKey 에 다중 accessToken 존재 시 타임아웃 가능(§3.8)
      timeoutMs: 3000,
    },
    transport,
  );
  return parseEnvelope<TossDisconnectByUserKeySuccess>(raw);
}

// ---------------------------------------------------------------------------
// 5. disconnectByAccessToken — accessToken 으로 연결 끊기 (§2.6)
// ---------------------------------------------------------------------------

/**
 * 서버에서 accessToken 으로 단일 토큰을 폐기한다.
 *
 * body 없음, Authorization 헤더만 전달.
 * ⚠️ 이 호출 시 사용자 발화 콜백(§2.7)은 발화되지 않는다.
 */
export async function disconnectByAccessToken(
  accessToken: string,
  transport?: MtlsTransport,
): Promise<TossDisconnectByAccessTokenSuccess> {
  const raw = await mtlsRequest(
    {
      baseUrl: TOSS_API_BASE_URL,
      method: 'POST',
      path: '/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-access-token',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    transport,
  );
  return parseEnvelope<TossDisconnectByAccessTokenSuccess>(raw);
}
