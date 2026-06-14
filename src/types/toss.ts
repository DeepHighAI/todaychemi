/**
 * toss.ts
 *
 * Apps-in-Toss mTLS API 응답 타입 정의.
 *
 * 출처: 구현 레퍼런스 §2(토스 로그인) + §3(mTLS) + §3.6(공통 응답 봉투)
 *
 * 소비하는 Route Handler 파일은 반드시 아래 선언 추가:
 *   export const runtime = 'nodejs';  // mTLS = Node https 전용, Edge runtime 금지
 */

// ---------------------------------------------------------------------------
// 공통 응답 봉투 (§3.6)
// ---------------------------------------------------------------------------

/**
 * 토스 API 공통 SUCCESS 봉투.
 * "resultType": "SUCCESS", "success": { ... }
 */
export interface TossSuccessEnvelope<T> {
  resultType: 'SUCCESS';
  success: T;
  error?: never;
}

/**
 * 토스 API 공통 FAIL 봉투.
 * "resultType": "FAIL", "error": { "errorCode": "...", "reason": "..." }
 */
export interface TossFailEnvelope {
  resultType: 'FAIL';
  error: { errorCode: string; reason?: string };
  success?: never;
}

/**
 * OAuth 베어 에러 봉투 — resultType 없는 토큰 교환/갱신 실패 전용.
 * "error": "invalid_grant"
 * §3.6 주의: generate-token/refresh-token 실패는 이 shape.
 */
export interface TossOAuthBareError {
  error: string; // e.g. "invalid_grant"
  resultType?: never;
}

/** 파싱 완료된 토스 API 응답 공용 유니온 */
export type TossEnvelope<T> =
  | TossSuccessEnvelope<T>
  | TossFailEnvelope
  | TossOAuthBareError;

// ---------------------------------------------------------------------------
// 에러 판별 헬퍼 타입
// ---------------------------------------------------------------------------

/** 토스 API 호출 실패를 나타내는 구조화 에러 */
export interface TossApiError {
  /** 오류 유형 식별자 */
  kind: 'toss_api_error';
  /** 실패 봉투 에러코드 ('FAIL' 봉투) 또는 OAuth 에러 문자열 */
  errorCode: string;
  /** 실패 이유(FAIL 봉투에만 있을 수 있음) */
  reason?: string;
}

// ---------------------------------------------------------------------------
// 토큰 교환 / 갱신 (§2.3, §2.4)
// ---------------------------------------------------------------------------

/** generate-token / refresh-token 성공 응답 */
export interface TossTokenSuccess {
  /** 고정 "bearer" (샘플은 "Bearer", 대소문자 불일치) */
  tokenType: string;
  /** JWT RS256 — iss: https://cert.toss.im. 유효 1시간 */
  accessToken: string;
  /** 유효 14일. 만료 시 appLogin() 재실행 필요 */
  refreshToken: string;
  /** 남은 유효시간(초). 샘플 3599 */
  expiresIn: number;
  /** 공백 구분 동의 scope 목록 */
  scope: string;
}

/** generate-token 요청 바디 (§2.3) */
export interface TossGenerateTokenBody {
  authorizationCode: string;
  /** appLogin() 반환값 그대로 전달 */
  referrer: 'DEFAULT' | 'SANDBOX';
}

/** refresh-token 요청 바디 (§2.4) */
export interface TossRefreshTokenBody {
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// login-me (§2.5)
// ---------------------------------------------------------------------------

/**
 * login-me 성공 응답.
 * userKey/scope/agreedTerms = 비암호화.
 * 나머지 PII 필드 = AES-256-GCM 암호화(별도 복호화 레이어 — 현재 미구현).
 *
 * 2026-01-02 이후 scope 에 "user_key" 추가 → 미지 scope 값 허용 필요.
 * scope 구분자 이중성: generate-token=공백, login-me=콤마 → 내부에서 tolerant 분리.
 */
export interface TossLoginMeSuccess {
  /** 앱 스코프 고유 식별자(숫자). 동일 사용자도 앱별 다름. */
  userKey: number;
  /** 동의된 scope 문자열. 구분자: 콤마 또는 공백(version mismatch 주의). */
  scope: string;
  /** 동의 약관 태그 목록 */
  agreedTerms: string[];
  // --- 아래는 AES-256-GCM 암호화 PII 필드 (미복호화 상태) ---
  name?: string;
  phone?: string;
  /** 생년월일 yyyyMMdd 형식. 시각 없음 → 앱 자체 입력 폼 별도 필요(§2.1 D-SCOPE-1). */
  birthday?: string;
  ci?: string;
  gender?: string;
  nationality?: string;
  email?: string;
  /** di = 항상 null (§2.5) */
  di?: null;
}

/**
 * 복호화 불필요한 비-PII 필드만 추출한 안전 서브셋.
 * 서버 내부 로직은 가능하면 이 타입만 사용할 것 — PII 필드 접촉 최소화(ADR-040 §5).
 */
export type TossLoginMePublic = Pick<TossLoginMeSuccess, 'userKey' | 'scope' | 'agreedTerms'>;

/**
 * scope 문자열을 토큰 배열로 변환한 구조체.
 * tolerant splitter: 콤마/공백 모두 분리 후 빈 토큰 제거.
 */
export interface TossParsedScope {
  /** 원본 scope 문자열 */
  raw: string;
  /** 파싱된 scope 토큰 배열 */
  tokens: string[];
}

// ---------------------------------------------------------------------------
// Disconnect (§2.6)
// ---------------------------------------------------------------------------

/** remove-by-user-key 성공 응답 */
export interface TossDisconnectByUserKeySuccess {
  userKey: number;
}

/** remove-by-access-token 성공 응답 (body shape 미문서화 → unknown 처리) */
export type TossDisconnectByAccessTokenSuccess = Record<string, unknown>;

// ---------------------------------------------------------------------------
// mTLS 클라이언트 내부 타입
// ---------------------------------------------------------------------------

/** mtlsRequest 함수 파라미터 */
export interface MtlsRequestOptions {
  /** Base URL: 'https://apps-in-toss-api.toss.im' 또는 'https://pay-apps-in-toss-api.toss.im' */
  baseUrl: string;
  method: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string>;
  /** POST body 객체 — undefined 면 body 없음 */
  body?: unknown;
  /**
   * Node http.ClientRequest 타임아웃(ms).
   * remove-by-user-key 전용 3000ms(§3.8). 다른 엔드포인트는 기본값 사용.
   */
  timeoutMs?: number;
}

/**
 * 테스트 주입용 transport 인터페이스.
 * 실제 구현은 Node https.request. 테스트는 mock 주입으로 네트워크 없이 검증.
 */
export type MtlsTransport = (opts: MtlsRequestOptions) => Promise<unknown>;

// ---------------------------------------------------------------------------
// 인증서 회전 옵션 (§3.2, §3.9 체크리스트 8번)
// ---------------------------------------------------------------------------

/**
 * 무중단 cert 회전을 위한 선택 NEXT 인증서.
 * 문서상 "다중 인증서 관리" 기능 — 구 cert 유효 유지 + 신규 cert 콘솔 등록 후
 * 환경변수 신규 PEM 배포 → 구 cert 만료 사이클.
 * 오늘케미는 NEXT 페어를 env 에만 문서화하며 실제 회전은 Vercel env 재배포로 처리.
 */
export interface TossCertPair {
  cert: string;
  key: string;
}
