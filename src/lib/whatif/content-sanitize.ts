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

function sanitizeTuple<T extends readonly string[]>(items: T): T {
  return items.map(sanitizeWhatifBody) as unknown as T;
}

function sanitizeStringArray(items: readonly string[]): string[] {
  return items.map(sanitizeWhatifBody);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeOptionalTuple<T extends readonly string[]>(
  items: T | undefined,
): T | undefined {
  return items ? sanitizeTuple(items) : undefined;
}

function sanitizeOptionalStringArray(items: readonly string[] | undefined): string[] {
  return Array.isArray(items) ? sanitizeStringArray(items) : [];
}

// body 뿐 아니라 구조화 섹션들도 동일 LLM·프롬프트에서 생성되는 자유텍스트이므로
// 같은 파생필드 주석이 새어 들어올 수 있다 — 함께 정화한다 (keywords 는 토큰이라 제외).
export function sanitizeWhatifContent(content: WhatifContent): WhatifContent {
  const todayContext = isRecord(content.today_context) ? content.today_context : null;
  const sajuBasis = isRecord(content.saju_basis) ? content.saju_basis : null;
  const situationReading = isRecord(content.situation_reading) ? content.situation_reading : null;

  return {
    ...content,
    body: sanitizeWhatifBody(content.body),
    ...(todayContext && {
      today_context: {
        title: sanitizeWhatifBody(String(todayContext.title ?? '')),
        summary: sanitizeWhatifBody(String(todayContext.summary ?? '')),
        day_signal: sanitizeWhatifBody(String(todayContext.day_signal ?? '')),
      },
    }),
    ...(sajuBasis && {
      saju_basis: {
        day_master: sanitizeWhatifBody(String(sajuBasis.day_master ?? '')),
        dominant_sipsin: sanitizeOptionalStringArray(sajuBasis.dominant_sipsin as string[] | undefined),
        missing_sipsin: sanitizeOptionalStringArray(sajuBasis.missing_sipsin as string[] | undefined),
        sinkang: sajuBasis.sinkang ? sanitizeWhatifBody(String(sajuBasis.sinkang)) : null,
        yongsin_candidates: sanitizeOptionalStringArray(sajuBasis.yongsin_candidates as string[] | undefined),
        notes: sanitizeTuple(
          (Array.isArray(sajuBasis.notes) && sajuBasis.notes.length === 3
            ? sajuBasis.notes
            : ['', '', '']) as [string, string, string],
        ),
      },
    }),
    ...(situationReading && {
      situation_reading: {
        strength: sanitizeTuple(
          (Array.isArray(situationReading.strength) && situationReading.strength.length === 3
            ? situationReading.strength
            : ['', '', '']) as [string, string, string],
        ),
        caution: sanitizeTuple(
          (Array.isArray(situationReading.caution) && situationReading.caution.length === 3
            ? situationReading.caution
            : ['', '', '']) as [string, string, string],
        ),
      },
    }),
    do_first: sanitizeTuple(content.do_first),
    ...(content.avoid_today && {
      avoid_today: sanitizeTuple(content.avoid_today),
    }),
    ...(sanitizeOptionalTuple(content.first_meet_tips) && {
      first_meet_tips: sanitizeTuple(content.first_meet_tips!),
    }),
    ...(content.classic_citation && {
      classic_citation: content.classic_citation,
    }),
  };
}
