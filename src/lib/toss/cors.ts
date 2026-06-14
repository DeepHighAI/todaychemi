/**
 * Apps-in-Toss 미니앱 CORS 헬퍼
 *
 * 미니앱(Vite SPA, *.apps.tossmini.com / *.private-apps.tossmini.com)이
 * /api/* 라우트를 Bearer 토큰으로 크로스오리진 호출할 때 필요한 CORS 헤더를 다룬다.
 *
 * 설계 원칙:
 *   - 동일 오리진 요청(Origin 헤더 없음 / 자체 도메인)은 완전 무영향.
 *   - 허용 오리진은 env TOSS_ALLOWED_ORIGINS (쉼표 구분)에서만 읽는다.
 *   - Bearer 자격증명을 쓰므로 와일드카드(*) 대신 요청 Origin 을 에코한다.
 *   - preflight(OPTIONS) 는 auth/세션 로직 없이 204 단락 반환.
 *
 * 출처: docs/research/apps_in_toss_integration_review_2026-06-07.md §3.2
 */

// ---------------------------------------------------------------------------
// 허용 오리진 파싱
// ---------------------------------------------------------------------------

/**
 * 환경변수 TOSS_ALLOWED_ORIGINS 를 파싱해 소문자 오리진 집합으로 반환한다.
 *
 * 기본값: todaychemi 앱인토스 dev/prod 오리진 쌍.
 * appName 이 확정되면 TOSS_ALLOWED_ORIGINS 에 최종 값을 설정해야 한다.
 */
export function getAllowedTossOrigins(): Set<string> {
  const raw =
    process.env.TOSS_ALLOWED_ORIGINS ??
    'https://todaychemi.apps.tossmini.com,https://todaychemi.private-apps.tossmini.com';

  return new Set(
    raw
      .split(',')
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean),
  );
}

// ---------------------------------------------------------------------------
// CORS 헤더 상수
// ---------------------------------------------------------------------------

const CORS_ALLOW_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const CORS_ALLOW_HEADERS = 'Authorization, Content-Type';
const CORS_MAX_AGE = '600'; // 10분

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 요청 Origin 이 허용 목록에 있으면 대응 CORS 헤더를 반환한다.
 * 허용 목록에 없으면 undefined 를 반환하며, 호출자는 헤더를 추가하지 않는다.
 */
export function buildCorsHeaders(origin: string | null): Record<string, string> | undefined {
  if (!origin) return undefined;

  const allowed = getAllowedTossOrigins();
  if (!allowed.has(origin.toLowerCase())) return undefined;

  return {
    'Access-Control-Allow-Origin': origin, // Bearer 사용 → Origin 에코
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Max-Age': CORS_MAX_AGE,
    'Vary': 'Origin',
  };
}

/**
 * 요청이 apps-in-toss 허용 오리진에서 온 preflight(OPTIONS)인지 판별한다.
 * true 이면 middleware 에서 세션/인증 로직 없이 204 를 즉시 반환해야 한다.
 */
export function isTossPreflightRequest(request: { method: string; headers: { get(name: string): string | null } }): boolean {
  if (request.method !== 'OPTIONS') return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return getAllowedTossOrigins().has(origin.toLowerCase());
}
