/**
 * toss-session.ts
 *
 * Apps-in-Toss Storage SDK 기반 세션 토큰 영속화 헬퍼.
 * iOS WebView 환경에서 쿠키가 차단되므로 Bearer 토큰을 네이티브 Storage 에 보관한다.
 *
 * 웹 브라우저(dev server)에서는 Storage SDK 가 미지원이므로
 * localStorage 폴백을 사용한다.
 */

import { Storage, getOperationalEnvironment } from '@apps-in-toss/web-framework';

import { isJwtExpired } from './jwt';

/** Storage 키 상수 */
const TOKEN_KEY = 'ait:session:token';

/**
 * Toss WebView(네이티브) 환경 여부. SDK `getOperationalEnvironment()` 로 감지한다.
 * 자동 로그인(appLogin)·Storage 사용 분기에 공통으로 쓴다.
 *
 * - `'toss'`(실기기) / `'sandbox'`(QA) 모두 실제 토스 브릿지가 살아있어 appLogin 이 동작 → true.
 * - 브라우저 dev 프리뷰에는 브릿지가 없어 호출이 throw → catch 로 false(비네이티브).
 */
export function isNativeTossEnv(): boolean {
  try {
    const env = getOperationalEnvironment();
    return env === 'toss' || env === 'sandbox';
  } catch {
    return false;
  }
}

/**
 * Storage SDK 가 실제 네이티브 환경인지 여부를 감지한다.
 * 웹 개발 서버에서는 getItem 이 즉시 null 을 반환하거나 reject 될 수 있다.
 */
function isNativeStorage(): boolean {
  return isNativeTossEnv();
}

/** 저장된 Bearer 토큰을 반환한다. 없으면 null. */
export async function getToken(): Promise<string | null> {
  // 개발 환경 오버라이드: dev(serve) 빌드에서만 VITE_DEV_BEARER 를 사용한다.
  // ⚠️ DEV 게이트는 프로덕션(.ait)에서 런타임 "사용"만 막는다 — vite8/rolldown 은 토큰
  // 문자열을 번들에서 DCE하지 못하므로, 미인라인은 vite.config.ts 의 빌드 가드가 보장한다.
  const devBearer = import.meta.env.DEV
    ? (import.meta.env.VITE_DEV_BEARER as string | undefined)
    : undefined;
  if (devBearer) return devBearer;

  try {
    const raw = isNativeStorage()
      ? await Storage.getItem(TOKEN_KEY)
      : // 웹 폴백 — dev server / 브라우저 환경
        localStorage.getItem(TOKEN_KEY);
    // 만료된 저장 토큰은 "없음"으로 취급한다 — 그대로 복원하면 서버 getUser 가 403
    // (bad_jwt: token is expired)으로 거부해 모든 API 가 영구 401 이 된다. 부트스트랩은
    // null 을 받아 재로그인으로 이어진다.
    if (raw && isJwtExpired(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Bearer 토큰을 영속 저장한다. */
export async function setToken(token: string): Promise<void> {
  try {
    if (isNativeStorage()) {
      await Storage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // 저장 실패는 묵시적으로 무시 — 다음 로그인 시 재시도
  }
}

/** 저장된 토큰을 삭제한다(로그아웃). */
export async function clearToken(): Promise<void> {
  try {
    if (isNativeStorage()) {
      await Storage.removeItem(TOKEN_KEY);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // 삭제 실패도 무시 — 보안상 최선이지만 치명적이지 않음
  }
}
