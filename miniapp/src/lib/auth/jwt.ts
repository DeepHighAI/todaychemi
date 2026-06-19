/**
 * jwt.ts — Supabase access token 만료 판정 (클라이언트, 순수 함수).
 *
 * Supabase access token 은 기본 1시간(exp) 만료된다. 미니앱은 토큰을 Toss Storage 에
 * 영속하므로, 부트스트랩에서 만료 토큰을 그대로 복원하면 모든 API 가 401(서버 getUser 403
 * `bad_jwt: token is expired`)로 영구 실패한다. 이 헬퍼로 만료를 판정해 재로그인을 유도한다.
 *
 * 네트워크 없이 payload 의 `exp` 클레임만 본다(서명 검증은 서버 몫). 디코드 실패·exp 부재는
 * "만료(사용 불가)"로 보수적으로 취급한다.
 */

/** base64url 문자열을 디코드한다(브라우저 atob 기반). 실패 시 null. */
function decodeBase64Url(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return atob(padded);
  } catch {
    return null;
  }
}

/**
 * JWT 가 만료됐는지(또는 파싱 불가/exp 부재인지) 판정한다.
 * @param token  JWT 문자열
 * @param skewSeconds  시계 오차 여유(기본 60초) — 만료 직전이면 미리 만료 취급해 경계 401 회피
 * @returns 만료/사용불가면 true
 */
export function isJwtExpired(token: string | null | undefined, skewSeconds = 60): boolean {
  if (!token) return true;
  const parts = token.split('.');
  if (parts.length !== 3) return true;

  const json = decodeBase64Url(parts[1]);
  if (!json) return true;

  let payload: { exp?: unknown };
  try {
    payload = JSON.parse(json) as { exp?: unknown };
  } catch {
    return true;
  }

  const exp = payload.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return true;

  // exp 는 초 단위 epoch. 현재 시각 + skew 가 exp 를 넘으면 만료.
  const nowSec = Date.now() / 1000;
  return nowSec + skewSeconds >= exp;
}
