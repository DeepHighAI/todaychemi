/**
 * chart.ts — ChartCore + YunseCore 타입 정의 (웹앱 src/types/chart.ts 핵심 부분)
 *
 * 웹앱 원본: src/types/chart.ts (read-only reference)
 * 미니앱: Zod / saju 내부 모듈 의존 없이 필요한 인터페이스만 추출.
 */

export type OhaengElement = '목' | '화' | '토' | '금' | '수';

// ---------------------------------------------------------------------------
// 윤세 타입
// ---------------------------------------------------------------------------

export interface YunseDaeun {
  readonly start_age: number;
  readonly list: ReadonlyArray<{ age: number; pillar: string; year: number }>;
  readonly current_index: number;
}

export interface YunseSeyun {
  readonly current_pillar: string;
  readonly current_year: number;
}

export interface YunseWolun {
  readonly current_pillar: string;
  readonly current_month: string; // YYYY-MM (KST)
}

export interface YunseIliun {
  readonly today_pillar: string;
  readonly today_date: string; // YYYY-MM-DD (KST)
}

export interface YunseCore {
  readonly daeun: YunseDaeun;
  readonly seyun: YunseSeyun;
  readonly wolun: YunseWolun;
  readonly iliun: YunseIliun;
}

// ---------------------------------------------------------------------------
// 사주 계산 결과 (ChartCore — LLM 페이로드 허용 형태)
// PII: birth_date / gender 원본은 포함 금지
// ---------------------------------------------------------------------------

export interface ChartCore {
  year_pillar: string;
  month_pillar: string | null;
  day_pillar: string;
  hour_pillar: string | null;
  day_master_element: OhaengElement;
  five_elements_counts: Record<OhaengElement, number>;
  gender_normalized: 'M' | 'F';
  yunse: YunseCore;
  // 파생층 — 미니앱에서는 직접 접근하지 않음 (LLM 페이로드용)
  derived?: unknown;
}
