/**
 * client.ts
 *
 * 타입드 fetch 래퍼 — 웹앱 API (todaychemi.vercel.app) 호출용.
 *
 * - Base URL: VITE_API_BASE_URL 환경변수 (기본값: 프로덕션 호스트)
 * - Auth: Authorization: Bearer <token> 헤더 자동 첨부
 * - 응답: JSON 파싱 + ApiError 던지기
 *
 * TODO(P4): 각 flow hook 에서 이 클라이언트를 사용해 실제 엔드포인트 연결.
 */

// TODO(P4): .env.local 에 VITE_API_BASE_URL=https://todaychemi.vercel.app 추가
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'https://todaychemi.vercel.app'; // TODO(P4): 프로덕션 URL 확정 시 교체

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
  const { token, body, headers: extraHeaders, ...rest } = options;

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
