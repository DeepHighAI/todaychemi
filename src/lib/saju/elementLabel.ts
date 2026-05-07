export type OhaengElement = '목' | '화' | '토' | '금' | '수';

interface ElementInfo {
  ko: string;
  hanja: string;
  color_class: string;
}

const ELEMENT_MAP: Record<OhaengElement, ElementInfo> = {
  목: { ko: '목', hanja: '木', color_class: 'bg-element-wood' },
  화: { ko: '화', hanja: '火', color_class: 'bg-element-fire' },
  토: { ko: '토', hanja: '土', color_class: 'bg-element-earth' },
  금: { ko: '금', hanja: '金', color_class: 'bg-element-metal' },
  수: { ko: '수', hanja: '水', color_class: 'bg-element-water' },
};

export function elementLabel(element: OhaengElement): ElementInfo {
  const info = ELEMENT_MAP[element];
  if (!info) throw new Error(`Unknown element: ${element}`);
  return info;
}
