/**
 * reauth.ts — 재인증 브리지 (모듈 싱글톤).
 *
 * `apiFetch`(client.ts)가 인증 401 을 받으면 이 브리지로 재로그인을 요청하고 새 토큰으로 1회
 * 재시도한다. AuthProvider 가 마운트 시 핸들러를 등록한다.
 *
 * - client.ts ↔ AuthProvider 의 순환 import 를 피하려고 별도 모듈로 둔다.
 * - single-flight: 여러 쿼리가 동시에 401 이어도 재로그인은 1회만 수행하고 결과를 공유한다.
 */

type ReauthHandler = () => Promise<string | null>;

let handler: ReauthHandler | null = null;
let inflight: Promise<string | null> | null = null;

/** 재로그인 핸들러를 등록/해제한다(AuthProvider 전용). */
export function setReauthHandler(fn: ReauthHandler | null): void {
  handler = fn;
}

/**
 * 재로그인을 트리거하고 새 토큰을 반환한다(없으면 null).
 * 진행 중인 재로그인이 있으면 그 Promise 를 공유한다(single-flight).
 */
export function triggerReauth(): Promise<string | null> {
  if (!handler) return Promise.resolve(null);
  if (!inflight) {
    inflight = Promise.resolve()
      .then(() => (handler ? handler() : null))
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** 테스트 전용 — 브리지 상태 초기화. */
export function __resetReauthForTest(): void {
  handler = null;
  inflight = null;
}
