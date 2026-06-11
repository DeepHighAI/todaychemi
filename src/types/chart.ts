import { z } from 'zod';

import type { Element5 } from '@/lib/saju/ganji';
import type { SinkangResult } from '@/lib/saju/sinkang';
import type { SipsinName } from '@/lib/saju/sipsin';
import type { YongsinResult } from '@/lib/saju/yongsin';

import { BirthCalendarSchema, BirthTimeKnowledgeSchema, GenderSchema, type Gender } from './relation';

// 파생층 enum 타입 — saju 모듈이 단일 출처, 여기서 재노출 (drift 방지)
export type { SipsinName } from '@/lib/saju/sipsin';
export type { SinkangLevel } from '@/lib/saju/sinkang';

// 사주 계산 입력 (DDL 기준 — `birth_time` 단일 time 필드)
const TimeStringRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const BirthDataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(TimeStringRegex).nullable(),
  time_knowledge: BirthTimeKnowledgeSchema,
  calendar: BirthCalendarSchema,
  is_lunar_leap: z.boolean().default(false),
  gender: GenderSchema,
});
export type BirthData = z.infer<typeof BirthDataSchema>;

// 윤세 타입 (docs/specs/yunse_spec.md)
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
// 파생층 (P1, 2026-06-11) — deriveSaju(src/lib/saju/derive.ts) 산출물.
// theory v3부터 normalize가 항상 부착 ("v3 ⇒ derived 존재" 불변식).
// 구 v2 jsonb row 호환을 위해 ChartCore.derived는 optional.
// ---------------------------------------------------------------------------

// 기둥별 십신 — day 슬롯의 stem은 '일간' 고정
export interface PillarSipsin {
  stem: SipsinName | '일간';
  branch: SipsinName;
}

// 지장간 숨은 천간 (한자 1글자 — 내부 데이터 레이어 허용, UI 노출 시 ADR-038 변환 필수)
export interface JijangganHidden {
  여기: string | null;
  중기: string | null;
  정기: string;
}

export interface SajuDerived {
  // 파생 알고리즘 자체 버전 — v2 (2026-06-12, R1): 사계월(辰戌丑未) 지장간 가중 중기/여기 교환.
  // 저장 v1 jsonb 는 resolveDerivedForLlm 이 요청 시 자동 재계산(self-heal) — DB 재기록 불필요.
  derived_version: 2;
  // hour_pillar !== null (시간 미상 여부)
  hour_known: boolean;
  sipsin: {
    year: PillarSipsin;
    month: PillarSipsin | null;
    day: PillarSipsin; // stem = '일간'
    hour: PillarSipsin | null;
    // 10키 전부(0 포함), '일간' 슬롯 제외 — 합 7(시有)/5(시無, 월無 시 가변)
    counts: Record<SipsinName, number>;
  };
  jijanggan: {
    year: JijangganHidden;
    month: JijangganHidden | null;
    day: JijangganHidden;
    hour: JijangganHidden | null;
  };
  // five_elements_counts(표면 카운트)와 완전 별개 필드 — 정수 스케일:
  // 천간 10 / 지장간 정기 10·중기 5·여기 3 (지지 표면오행 == 정기 오행이라 이중계상 없음)
  ohaeng_weighted: Record<Element5, number>;
  // 신강약 억부 점수제 — detail 분해항 포함 (설명가능성 + 전문가 검토용)
  sinkang: SinkangResult;
  // 용신·희신 억부 1차 룰 (오행 레벨)
  yongsin: YongsinResult;
  // 표면 글자 음양 집계 (8 또는 6) — 지지 음양 = 체(體) 기준
  yinyang_balance: { yang: number; yin: number };
  // 띠 — 년지 기준 한글 독음 (절기·입춘 학파: year_pillar가 이미 절기 기준)
  tti: { branch: string; animal_ko: string };
  // 일주 — 60갑자 key
  ilju: { pillar: string; gapja_index: number; ko: string };
}

// 사주 계산 결과 (LLM 페이로드 허용 형태 — chart_core)
// PII: birth_date / gender 원본은 포함 금지 (docs/legal/pii_minimization.md)
export interface ChartCore {
  year_pillar: string;
  month_pillar: string | null;
  day_pillar: string;
  hour_pillar: string | null;
  day_master_element: '목' | '화' | '토' | '금' | '수';
  five_elements_counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  // 정규화된 성별 — 원본 gender 대신 chart 계산 결과로만 LLM에 전달
  gender_normalized: Gender;
  // 윤세 (대운·세운·월운·일운) — 결정형, KST 기준
  yunse: YunseCore;
  // 파생층 — v3부터 normalize가 항상 부착 (구 v2 row 호환을 위해 optional).
  // 기둥 변형(합성 차트 등) 시 deriveSaju 재호출 의무 — stale derived 사용 금지.
  derived?: SajuDerived;
}

export type ChartHash = string;

// 온보딩 폼 입력 — S-01-B 가입 후 자신의 사주 정보 등록 (별명 + 생년월일)
export interface OnboardingFormInput {
  nickname: string;
  birth: BirthData;
}

export interface TheoryProfile {
  profile_version: string;
  ja_si_mode: 'late_zi' | 'early_zi';
  longitude_correction: boolean;
}

// v3 (2026-06-11): 파생층(derived) embedded — normalize가 SajuDerived(현행 derived_version 2)를
//   항상 부착한다 ("v3 ⇒ derived 존재" 불변식). derived_version 범프는 theory 버전과 독립 —
//   저장 구버전 derived 는 LLM projection 경계에서 자동 재계산된다.
// v2 (2026-06-11, ADR-021 Amended): 시주 진태양시 보정 도입(서울 기본 −32.1분 + 균시차).
// 엔진 동작 변경 시 반드시 범프 — chart_hash 입력에 포함되어 전 다운스트림 캐시가 분리된다.
// v1: 보정 없음 (벽시계 시각 그대로 시지 판정).
export const DEFAULT_THEORY_PROFILE_VERSION = 'v3';
