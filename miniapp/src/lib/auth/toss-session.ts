/**
 * toss-session.ts
 *
 * Apps-in-Toss Storage SDK 기반 세션 토큰 영속화 헬퍼.
 * iOS WebView 환경에서 쿠키가 차단되므로 Bearer 토큰을 네이티브 Storage 에 보관한다.
 *
 * 웹 브라우저(dev server)에서는 Storage SDK 가 미지원이므로
 * localStorage 폴백을 사용한다.
 */

import { Storage } from '@apps-in-toss/web-framework';

/** Storage 키 상수 */
const TOKEN_KEY = 'ait:session:token';

/**
 * Toss WebView 네이티브 환경 여부. 전역 주입 플래그(`__AIT_NATIVE__`)로 감지한다.
 * 자동 로그인(appLogin)·Storage 사용 분기에 공통으로 쓴다.
 */
export function isNativeTossEnv(): boolean {
  // Toss WebView 전역 주입 플래그 — 런타임에서 확인
  return typeof (globalThis as Record<string, unknown>).__AIT_NATIVE__ !== 'undefined';
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
  // import.meta.env.DEV 게이트로 프로덕션(.ait) 빌드에서는 사용/인라인되지 않는다(보안).
  const devBearer = import.meta.env.DEV
    ? (import.meta.env.VITE_DEV_BEARER as string | undefined)
    : undefined;
  if (devBearer) return devBearer;

  try {
    if (isNativeStorage()) {
      return await Storage.getItem(TOKEN_KEY);
    }
    // 웹 폴백 — dev server / 브라우저 환경
    return localStorage.getItem(TOKEN_KEY);
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
