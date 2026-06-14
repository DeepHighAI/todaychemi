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

/** API 호출 실패를 나타내는 타입드 에러 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
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
    // 서버가 JSON 에러 페이로드를 반환하는지 시도
    let code = 'UNKNOWN_ERROR';
    let message = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as {
        error?: string;
        message?: string;
      };
      code = errBody.error ?? code;
      message = errBody.message ?? message;
    } catch {
      // JSON 파싱 실패 시 기본 메시지 유지
    }
    throw new ApiError(response.status, code, message);
  }

  // 204 No Content — 빈 응답
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
