/**
 * use-preferences.ts — 테마·글자 크기 환경설정 zustand 스토어(단일 출처).
 *
 * - 테마 토글은 2단계(라이트 ↔ 다크). 명시 선택 전에는 시스템(OS) 값을 따른다.
 * - 글자 크기는 2단계(보통/크게). 'large' 는 tokens.css 의 zoom 으로 전체 UI 를 확대한다.
 * - 상태는 모듈 임포트 시 localStorage 에서 읽어 채운다(토글 아이콘·활성 옵션 초기값 정확).
 *   DOM 반영은 index.html 인라인 스크립트가 pre-paint 로 수행하고, init() 가 멱등 재동기화한다.
 *
 * 주의: "시스템 따름" 상태에서 OS 테마가 앱 실행 중 바뀌어도 라이브로 추종하지 않는다
 * (로드 시점에만 해석). 모바일 WebView 특성상 충분하며 리스너 수명 관리를 피한다.
 */

import { create } from 'zustand';

import { applyFontScale, applyTheme } from './apply';
import {
  type FontScale,
  type ResolvedTheme,
  type ThemePreference,
  prefersDarkOS,
  readStoredFontScale,
  readStoredTheme,
  writeStoredFontScale,
  writeStoredTheme,
} from './storage';

/** 선호값을 실제 적용 테마로 해석한다(null = 시스템). */
export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref ?? (prefersDarkOS() ? 'dark' : 'light');
}

interface PreferencesState {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  fontScale: FontScale;
  /** 저장값을 <html> 에 1회 동기화한다(App 마운트 시 호출, 인라인 스크립트와 멱등). */
  init: () => void;
  /** 저장소에서 상태를 다시 읽어 적용한다(복원·테스트용). */
  reloadFromStorage: () => void;
  /** 라이트 ↔ 다크 토글. 명시 선택으로 저장된다. */
  toggleTheme: () => void;
  /** 글자 크기를 설정·저장·적용한다. */
  setFontScale: (scale: FontScale) => void;
}

function readAll(): Pick<PreferencesState, 'themePreference' | 'resolvedTheme' | 'fontScale'> {
  const pref = readStoredTheme();
  return {
    themePreference: pref,
    resolvedTheme: resolveTheme(pref),
    fontScale: readStoredFontScale(),
  };
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...readAll(),

  init: () => {
    const { resolvedTheme, fontScale } = get();
    applyTheme(resolvedTheme);
    applyFontScale(fontScale);
  },

  reloadFromStorage: () => {
    const next = readAll();
    applyTheme(next.resolvedTheme);
    applyFontScale(next.fontScale);
    set(next);
  },

  toggleTheme: () => {
    const next: ResolvedTheme = get().resolvedTheme === 'dark' ? 'light' : 'dark';
    writeStoredTheme(next);
    applyTheme(next);
    set({ themePreference: next, resolvedTheme: next });
  },

  setFontScale: (scale) => {
    writeStoredFontScale(scale);
    applyFontScale(scale);
    set({ fontScale: scale });
  },
}));
