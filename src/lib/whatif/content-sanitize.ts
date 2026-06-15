import type { WhatifContent } from '@/types/diagnostic';

// 파생 필드 주석은 항상 `key: value` 또는 `key = value` 형태로만 누출된다.
// 키워드 뒤에 콜론/등호가 오는 경우만 제거하여, 같은 단어를 평범하게 언급하는
// 정상 프로즈(예: "신강한 기운")는 보존한다.
const RAW_DERIVED_FIELD_ANNOTATION =
  /\([^)]*(?:derived\s*[:=]|(?:dominant_sipsin|missing_sipsin|sipsin_distribution|jijanggan_elements|sinkang(?:\.verdict)?|yongsin_candidates|self_chart_core|chart_core)\s*[:=])[^)]*\)/gi;

const RAW_DAY_MASTER_ANNOTATION = /\(\s*일간\s*:\s*[목화토금수]\s*\)/g;

export function sanitizeWhatifBody(body: string): string {
  return body
    .replace(RAW_DERIVED_FIELD_ANNOTATION, '')
    .replace(RAW_DAY_MASTER_ANNOTATION, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?…])/g, '$1')
    .trim();
}

// body 뿐 아니라 do_first / first_meet_tips 도 동일 LLM·프롬프트에서 생성되는 자유텍스트이므로
// 같은 파생필드 주석이 새어 들어올 수 있다 — 함께 정화한다 (keywords 는 토큰이라 제외).
export function sanitizeWhatifContent(content: WhatifContent): WhatifContent {
  return {
    ...content,
    body: sanitizeWhatifBody(content.body),
    do_first: content.do_first.map(sanitizeWhatifBody) as [string, string, string],
    ...(content.first_meet_tips && {
      first_meet_tips: content.first_meet_tips.map(sanitizeWhatifBody) as [string, string, string],
    }),
  };
}
