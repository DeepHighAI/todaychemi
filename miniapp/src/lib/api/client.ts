/**
 * client.ts
 *
 * 타입드 fetch 래퍼 — 웹앱 API (todaychemi.vercel.app) 호출용.
 *
 * - Base URL: VITE_API_BASE_URL 환경변수 (기본값: 프로덕션 호스트)
 * - Auth: Authorization: Bearer <token> 헤더 자동 첨부
 * - 응답: JSON 파싱 + ApiError 던지기
 *
 * 모든 flow hook 이 이 클라이언트로 실제 엔드포인트를 호출한다.
 */

import { triggerReauth } from '@/lib/auth/reauth';

const PROD_API_HOST = 'https://todaychemi.vercel.app';

/**
 * API base URL 을 결정한다.
 *
 * `VITE_API_BASE_URL` 이 명시되면 그것을 쓰고, **빈 문자열·미설정**이면:
 *   - 프로덕션 빌드(.ait): 프로덕션 호스트로 폴백 (미니앱은 크로스오리진으로 웹 API 호출).
 *   - dev(serve): 빈 base 유지 → 상대경로 `/api` → vite dev 프록시.
 *
 * `?? ` 가 아니라 빈문자도 거르는 분기를 쓴다 — `.env.local` 의 `VITE_API_BASE_URL=`(빈값)이
 * 프로덕션 `.ait` 에 인라인돼 base 가 `''` 가 되면 로그인·API 가 미니앱 자기 오리진으로 가서
 * 404 로 깨지기 때문(실기기 로그인 실패 근본원인).
 */
export function resolveApiBaseUrl(env: { VITE_API_BASE_URL?: string; PROD?: boolean }): string {
  const explicit = env.VITE_API_BASE_URL?.trim();
  if (explicit) return explicit;
  return env.PROD ? PROD_API_HOST : '';
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env);

// ---------------------------------------------------------------------------
// 에러 타입
// ---------------------------------------------------------------------------

/** 402 PAYMENT_REQUIRED 응답이 운반하는 결제 정보 (P5 IAP 시트용) */
export interface PaymentRequiredInfo {
  feature: string;
  ref: string;
  amount_krw: number;
}

/** API 호출 실패를 나타내는 타입드 에러 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** 402 PAYMENT_REQUIRED 시 상위 레벨 결제 페이로드 */
    public readonly payment?: PaymentRequiredInfo,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// 요청 옵션
// ---------------------------------------------------------------------------

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Bearer 토큰 (없으면 인증 헤더 미첨부) */
  token?: string | null;
  /** 요청 바디 (자동으로 JSON.stringify) */
  body?: unknown;
  /** 내부 전용 — 401 재로그인 후 재시도 여부(무한 루프 방지). 호출자는 설정하지 않는다. */
  __isReauthRetry?: boolean;
}

// ---------------------------------------------------------------------------
// 핵심 fetch 래퍼
// ---------------------------------------------------------------------------

/**
 * API 엔드포인트를 호출한다.
 * @param path - `/api/...` 형태의 경로 (base URL 에 붙임)
 * @param options - fetch 옵션 + token/body 확장
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, body, headers: extraHeaders, __isReauthRetry, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string>),
  };

  // 토큰이 있으면 Authorization 헤더 첨부
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    // 인증 만료 자동 복구: 토큰을 보냈는데 401 이면(서버 getUser 가 만료 토큰을 거부) 재로그인 후
    // 새 토큰으로 1회 재시도한다. 토큰 미첨부 401·402(결제)·이미 재시도한 요청은 제외(루프 방지).
    if (response.status === 401 && token && !__isReauthRetry) {
      const fresh = await triggerReauth();
      if (fresh && fresh !== token) {
        return apiFetch<T>(path, { ...options, token: fresh, __isReauthRetry: true });
      }
    }

    // 웹 API 표준 에러 봉투: { error: { code, message } } (route-response.ts apiErrorResponse).
    // 402 PAYMENT_REQUIRED 는 상위 레벨에 { feature, ref, amount_krw } 동반(paymentRequiredResponse).
    let code = 'UNKNOWN_ERROR';
    let message = `HTTP ${response.status}`;
    let payment: PaymentRequiredInfo | undefined;
    try {
      const errBody = (await response.json()) as {
        error?: { code?: string; message?: string } | string;
        message?: string;
        feature?: string;
        ref?: string;
        amount_krw?: number;
      };
      if (typeof errBody.error === 'string') {
        // 레거시 문자열 형태 방어
        code = errBody.error;
      } else if (errBody.error && typeof errBody.error === 'object') {
        code = errBody.error.code ?? code;
        message = errBody.error.message ?? message;
      }
      if (errBody.message) message = errBody.message;
      // 402 결제 필요 — IAP 시트(P5)가 필요로 하는 페이로드 운반
      if (
        response.status === 402 &&
        typeof errBody.feature === 'string' &&
        typeof errBody.ref === 'string' &&
        typeof errBody.amount_krw === 'number'
      ) {
        payment = {
          feature: errBody.feature,
          ref: errBody.ref,
          amount_krw: errBody.amount_krw,
        };
      }
    } catch {
      // JSON 파싱 실패 시 기본값 유지
    }
    throw new ApiError(response.status, code, message, payment);
  }

  // 204 No Content — 빈 응답
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
