/**
 * storage.ts — 사용자 환경설정(테마·글자 크기) 영속화 헬퍼.
 *
 * 플랫 localStorage 키를 사용한다(zustand persist 의 중첩 JSON 대신):
 * index.html 의 인라인 부트스트랩 스크립트가 React 마운트 전(pre-paint)에
 * 동일 키를 동기적으로 읽어 FOUC 를 막기 때문이다.
 *
 * 토큰과 달리 테마/글자 크기는 손실돼도 시스템 기본값으로 폴백되므로
 * 토스 Storage SDK(비동기) 대신 localStorage(동기)만 사용한다.
 * 선례: HapcardPage 의 "쉽게 보기" 토글(hapcard_easy_mode).
 */

export type ThemePreference = 'light' | 'dark' | null; // null = 시스템 따름
export type ResolvedTheme = 'light' | 'dark';
export type FontScale = 'normal' | 'large';

export const THEME_STORAGE_KEY = 'twoday_theme';
export const FONT_SCALE_STORAGE_KEY = 'twoday_font_scale';

/** 저장된 테마 선호값. 명시 선택이 없으면 null(시스템 따름). */
export function readStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** 테마 선호값(명시 선택)을 저장한다. */
export function writeStoredTheme(value: ResolvedTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // 저장 실패는 무시 — 다음 로드 시 시스템 기본값으로 폴백
  }
}

/** 저장된 글자 크기. 없으면 'normal'. */
export function readStoredFontScale(): FontScale {
  try {
    return localStorage.getItem(FONT_SCALE_STORAGE_KEY) === 'large' ? 'large' : 'normal';
  } catch {
    return 'normal';
  }
}

/** 글자 크기를 저장한다. */
export function writeStoredFontScale(value: FontScale): void {
  try {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, value);
  } catch {
    // 저장 실패는 무시
  }
}

/** OS 다크 모드 선호 여부(matchMedia). jsdom 등 미지원 환경은 false. */
export function prefersDarkOS(): boolean {
  try {
    return Boolean(window.matchMedia) && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}
