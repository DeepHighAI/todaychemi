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
// 파생층 (ADR-040 SajuDerived) — 미니앱이 사용하는 부분만 추출한 느슨한 미러.
// 루트 src/types/chart.ts 의 SajuDerived 전체 중 yongsin/sinkang 만 타입화한다.
// (레거시 v2 차트는 derived 자체가 없을 수 있어 모든 필드 optional.)
// ---------------------------------------------------------------------------

export interface SajuDerivedYongsin {
  readonly basis?: string;
  readonly primary: OhaengElement;
  readonly secondary?: ReadonlyArray<OhaengElement>;
  readonly huisin?: OhaengElement;
}

export interface SajuDerivedSinkang {
  readonly level: '신강' | '중화' | '신약';
  readonly score?: number;
}

export interface SajuDerived {
  readonly derived_version?: number;
  readonly yongsin?: SajuDerivedYongsin;
  readonly sinkang?: SajuDerivedSinkang;
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
  // 파생층 (ADR-040) — 오늘의 부적은 yongsin/sinkang 만 읽는다. 레거시 v2 는 부재 가능.
  derived?: SajuDerived | null;
}
