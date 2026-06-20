/**
 * apply.ts — 환경설정 값을 <html> 속성에 반영한다.
 *
 * tokens.css 가 `:root[data-theme="dark"]` / `:root[data-font-scale="large"]`
 * 선택자로 토큰을 전환한다. index.html 의 인라인 스크립트가 pre-paint 로 같은
 * 속성을 설정하므로 여기서의 재적용은 멱등이다.
 */

import type { FontScale, ResolvedTheme } from './storage';

/** 해석된 테마를 <html data-theme> 에 반영한다. */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
}

/** 글자 크기를 <html data-font-scale> 에 반영한다('large' 일 때만 속성 부여). */
export function applyFontScale(scale: FontScale): void {
  if (typeof document === 'undefined') return;
  if (scale === 'large') {
    document.documentElement.setAttribute('data-font-scale', 'large');
  } else {
    document.documentElement.removeAttribute('data-font-scale');
  }
}
