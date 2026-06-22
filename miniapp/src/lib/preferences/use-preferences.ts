/**
 * use-preferences.ts — 테마·글자 크기 환경설정 zustand 스토어(단일 출처).
 *
 * - 앱인토스 비게임 출시 가이드에 맞춰 테마는 라이트 모드로 고정한다.
 * - 글자 크기는 2단계(보통/크게). 'large' 는 tokens.css 의 zoom 으로 전체 UI 를 확대한다.
 * - 상태는 모듈 임포트 시 localStorage 에서 읽어 채운다(글자 크기 활성 옵션 초기값 정확).
 *   DOM 반영은 index.html 인라인 스크립트가 pre-paint 로 수행하고, init() 가 멱등 재동기화한다.
 */

import { create } from 'zustand';

import { applyFontScale, applyTheme } from './apply';
import {
  type FontScale,
  type ResolvedTheme,
  type ThemePreference,
  readStoredFontScale,
  writeStoredFontScale,
} from './storage';

/** 비게임 출시 가이드 기준: 저장값·OS 선호와 무관하게 라이트로 해석한다. */
export function resolveTheme(_pref: ThemePreference): ResolvedTheme {
  return 'light';
}

interface PreferencesState {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  fontScale: FontScale;
  /** 저장값을 <html> 에 1회 동기화한다(App 마운트 시 호출, 인라인 스크립트와 멱등). */
  init: () => void;
  /** 저장소에서 상태를 다시 읽어 적용한다(복원·테스트용). */
  reloadFromStorage: () => void;
  /** 글자 크기를 설정·저장·적용한다. */
  setFontScale: (scale: FontScale) => void;
}

function readAll(): Pick<PreferencesState, 'themePreference' | 'resolvedTheme' | 'fontScale'> {
  return {
    themePreference: null,
    resolvedTheme: 'light',
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

  setFontScale: (scale) => {
    writeStoredFontScale(scale);
    applyFontScale(scale);
    set({ fontScale: scale });
  },
}));
