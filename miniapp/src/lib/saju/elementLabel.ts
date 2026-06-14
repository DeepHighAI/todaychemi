/**
 * elementLabel.ts — 오행 메타 (웹앱과 동일, next/* 없음)
 *
 * 웹앱 원본: src/lib/saju/elementLabel.ts (read-only reference)
 * color_class 는 미니앱에서 CSS 변수 인라인 스타일로 전환한다.
 * 웹앱은 Tailwind bg-element-* 클래스를 사용하지만 미니앱에서는 tokens.css 변수만 허용.
 */

export type OhaengElement = '목' | '화' | '토' | '금' | '수';

interface ElementInfo {
  ko: string;
  hanja: string;
  /** tokens.css 기반 CSS 변수 색상 */
  color: string;
}

const ELEMENT_MAP: Record<OhaengElement, ElementInfo> = {
  목: { ko: '목', hanja: '木', color: 'var(--accent-wood)' },
  화: { ko: '화', hanja: '火', color: 'var(--accent-fire)' },
  토: { ko: '토', hanja: '土', color: 'var(--accent-earth)' },
  금: { ko: '금', hanja: '金', color: 'var(--accent-metal)' },
  수: { ko: '수', hanja: '水', color: 'var(--accent-water)' },
};

export function elementLabel(element: OhaengElement): ElementInfo {
  const info = ELEMENT_MAP[element];
  if (!info) throw new Error(`Unknown element: ${element}`);
  return info;
}
