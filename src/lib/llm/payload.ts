import { z } from 'zod';

import type { CrossAnalysis } from '@/lib/saju/cross';
import { deriveSaju } from '@/lib/saju/derive';
import type { ChartCore, SajuDerived, SipsinName, YunseCore } from '@/types/chart';
import type { Mode } from '@/types/mode';

// AGENTS.md §5 — LLM 페이로드 화이트리스트:
// chart_core(self) + chart_core(relation) + mode + question_slot? + theory_profile.profile_version
// time_context: target_date / replay 일진 날짜 (PII 아님, 모든 사용자 공통 공개 정보)
// cross_analysis: 결정형 교차분석 facts — LLM 해석 근거 전용, 점수 무개입 (ADR-035)
// 절대 포함 금지: birth_date, name, nickname, email, birth_place, raw gender,
// 점수 (compat_score, score_breakdown — ADR-035), 출생연도 원본 (age_gap band 만 허용)

// Phase Y2 (yunse_spec.md §7): 전체 daeun.list 10개 대신 현재 대운 1개만 전달 (토큰 절약)
export interface LlmYunse {
  daeun: {
    start_age: number;
    current_index: number;
    current: { age: number; pillar: string; year: number };
  };
  seyun: { current_pillar: string; current_year: number };
  wolun: { current_pillar: string; current_month: string };
  iliun: { today_pillar: string; today_date: string };
}

// ---------------------------------------------------------------------------
// P3: derived 압축 projection — 풀 SajuDerived(8슬롯 맵·detail 분해항) 대신
// LLM 해석에 필요한 요약만 의도적으로 전달한다 (설계 §2.1, 토큰 절약).
// ---------------------------------------------------------------------------

// 십신 5그룹 — 비겁=비견+겁재 / 식상=식신+상관 / 재성=편재+정재 / 관성=편관+정관 / 인성=편인+정인
const SIPSIN_GROUP_ORDER = ['비겁', '식상', '재성', '관성', '인성'] as const;
type LlmSipsinGroup = (typeof SIPSIN_GROUP_ORDER)[number];

// dominant 최대 개수 / 용신 후보 최대 개수 (설계 §2.1)
const DOMINANT_SIPSIN_MAX = 2;
const YONGSIN_CANDIDATES_MAX = 3;

export interface LlmDerived {
  // 자기 글자(일간 슬롯 제외) 십신 5그룹 집계 — 5키 전부 존재(0 포함)
  sipsin_distribution: Record<LlmSipsinGroup, number>;
  // 최다 그룹 최대 2 — count>0 그룹만, 동률은 고정 그룹 순서(비겁→인성) — 결정성
  dominant_sipsin: string[];
  // count=0 그룹 (고정 그룹 순서)
  missing_sipsin: string[];
  // 지장간 가중 오행 분포 — 정수 스케일 그대로 (설계 §2.1)
  jijanggan_elements: Record<'목' | '화' | '토' | '금' | '수', number>;
  // 숫자 score 의도적 제외 — findScoreLeak 오탐 + ADR-035 혼동 회피 (verdict 만)
  sinkang: { verdict: '신강' | '신약' | '중화' };
  // 오행 한글, primary → secondary 순 최대 3
  yongsin_candidates: string[];
  yinyang: { yang: number; yin: number };
  zodiac_animal: string; // 예: '말띠'
}

const ElementKoSchema = z.enum(['목', '화', '토', '금', '수']);
const Element5CountsSchema = z.object({
  목: z.number(),
  화: z.number(),
  토: z.number(),
  금: z.number(),
  수: z.number(),
});

// 경량 경계 스키마 — projection이 읽는 필드만 검증 (non-strict: 미지 필드 통과).
// DB jsonb 경유 derived 변형 방어 — 실패 시 fail-open(derived 생략, 설계 §2.4).
export const SajuDerivedSchema = z.object({
  // 버전 고정 — 미래 derived_version 2 가 v1 의미론으로 잘못 투영되는 것 차단
  // (parse 실패 → resolveDerivedForLlm 의 warn-and-omit 경로, 리뷰 api-contract)
  derived_version: z.literal(1),
  sipsin: z.object({
    counts: z.object({
      비견: z.number(),
      겁재: z.number(),
      식신: z.number(),
      상관: z.number(),
      편재: z.number(),
      정재: z.number(),
      편관: z.number(),
      정관: z.number(),
      편인: z.number(),
      정인: z.number(),
    }),
  }),
  ohaeng_weighted: Element5CountsSchema,
  sinkang: z.object({ level: z.enum(['신강', '중화', '신약']) }),
  yongsin: z.object({ primary: ElementKoSchema, secondary: z.array(ElementKoSchema) }),
  yinyang_balance: z.object({ yang: z.number(), yin: z.number() }),
  tti: z.object({ animal_ko: z.string() }),
});

// SajuDerived → LlmDerived 명시 필드별 projection (설계 §2.1)
export function projectDerivedForLlm(derived: SajuDerived): LlmDerived {
  const counts: Record<SipsinName, number> = derived.sipsin.counts;

  // 5그룹 집계 — 명시 합산 (그룹 구성 잠금)
  const distribution: Record<LlmSipsinGroup, number> = {
    비겁: counts.비견 + counts.겁재,
    식상: counts.식신 + counts.상관,
    재성: counts.편재 + counts.정재,
    관성: counts.편관 + counts.정관,
    인성: counts.편인 + counts.정인,
  };

  // dominant: count>0 그룹을 count 내림차순 정렬 — 동률은 고정 그룹 순서 유지(stable sort)
  const dominant = SIPSIN_GROUP_ORDER.filter((group) => distribution[group] > 0)
    .sort((a, b) => distribution[b] - distribution[a])
    .slice(0, DOMINANT_SIPSIN_MAX);

  const missing = SIPSIN_GROUP_ORDER.filter((group) => distribution[group] === 0);

  return {
    sipsin_distribution: distribution,
    dominant_sipsin: dominant,
    missing_sipsin: missing,
    jijanggan_elements: {
      목: derived.ohaeng_weighted.목,
      화: derived.ohaeng_weighted.화,
      토: derived.ohaeng_weighted.토,
      금: derived.ohaeng_weighted.금,
      수: derived.ohaeng_weighted.수,
    },
    sinkang: { verdict: derived.sinkang.level },
    yongsin_candidates: [derived.yongsin.primary, ...derived.yongsin.secondary].slice(
      0,
      YONGSIN_CANDIDATES_MAX,
    ),
    yinyang: { yang: derived.yinyang_balance.yang, yin: derived.yinyang_balance.yin },
    zodiac_animal: `${derived.tti.animal_ko}띠`,
  };
}

// derived 확보 + 경계 검증 — fail-open (설계 §2.4):
//   ① chart.derived 부재(v2 레거시 jsonb row) → deriveSaju 순수 함수 폴백 (P1 동치 보장)
//   ② safeParse 실패(jsonb 변형) 또는 폴백 계산 실패 → derived 생략 + warn (요청 차단 금지)
export function resolveDerivedForLlm(chart: ChartCore): LlmDerived | undefined {
  try {
    const source =
      chart.derived ??
      deriveSaju({
        year_pillar: chart.year_pillar,
        month_pillar: chart.month_pillar,
        day_pillar: chart.day_pillar,
        hour_pillar: chart.hour_pillar,
      });
    const parsed = SajuDerivedSchema.safeParse(source);
    if (!parsed.success) {
      console.warn('[DERIVED_INVALID]', {
        issues: parsed.error.issues.map((issue) => issue.path.join('.')),
      });
      return undefined;
    }
    return projectDerivedForLlm(source);
  } catch (err) {
    console.warn('[DERIVED_INVALID]', {
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// P3: derived는 압축 LlmDerived projection으로만 전달 — 풀 SajuDerived 타입 차단 유지
export interface LlmChartCore extends Omit<ChartCore, 'yunse' | 'derived'> {
  yunse: LlmYunse;
  derived?: LlmDerived; // optional — derived 변형/계산 실패 시 fail-open 생략
}

export interface LlmPayload {
  self_chart_core: LlmChartCore;
  relation_chart_core: LlmChartCore;
  mode: Mode;
  theory_profile: { profile_version: string };
  question_slot?: string;
  time_context?: { target_date?: string; jinjin_date?: string }; // YYYY-MM-DD KST
  // 교차분석 facts — 결정형, LLM 해석 근거 전용 (점수 무개입 ADR-035). verbatim 패스스루.
  cross_analysis?: CrossAnalysis;
}

export interface BuildLlmPayloadInput {
  self: ChartCore;
  relation: ChartCore;
  mode: Mode;
  theory_profile_version: string;
  question_slot?: string;
  target_date?: string;
  // computeCrossAnalysis 산출물 — 제공 시 그대로 전달 (hapcard/replay 배선, today는 압축본 별도)
  cross_analysis?: CrossAnalysis;
}

function projectYunseForLlm(yunse: YunseCore): LlmYunse {
  const idx = yunse.daeun.current_index;
  const cur = yunse.daeun.list[idx];
  return {
    daeun: {
      start_age: yunse.daeun.start_age,
      current_index: idx,
      current: { age: cur.age, pillar: cur.pillar, year: cur.year },
    },
    seyun: { current_pillar: yunse.seyun.current_pillar, current_year: yunse.seyun.current_year },
    wolun: { current_pillar: yunse.wolun.current_pillar, current_month: yunse.wolun.current_month },
    iliun: { today_pillar: yunse.iliun.today_pillar, today_date: yunse.iliun.today_date },
  };
}

function projectFiveElementsForLlm(
  counts: ChartCore['five_elements_counts'],
): ChartCore['five_elements_counts'] {
  return {
    목: counts.목,
    화: counts.화,
    토: counts.토,
    금: counts.금,
    수: counts.수,
  };
}

export function projectChartForLlm(chart: ChartCore): LlmChartCore {
  const core: LlmChartCore = {
    year_pillar: chart.year_pillar,
    month_pillar: chart.month_pillar,
    day_pillar: chart.day_pillar,
    hour_pillar: chart.hour_pillar,
    day_master_element: chart.day_master_element,
    five_elements_counts: projectFiveElementsForLlm(chart.five_elements_counts),
    gender_normalized: chart.gender_normalized,
    yunse: projectYunseForLlm(chart.yunse),
  };
  // 압축 derived projection — 모든 호출 플로우(hapcard/replay/today) 공통 적용
  const derived = resolveDerivedForLlm(chart);
  if (derived !== undefined) {
    core.derived = derived;
  }
  return core;
}

export function buildLlmPayload(input: BuildLlmPayloadInput): LlmPayload {
  const payload: LlmPayload = {
    self_chart_core: projectChartForLlm(input.self),
    relation_chart_core: projectChartForLlm(input.relation),
    mode: input.mode,
    theory_profile: { profile_version: input.theory_profile_version },
  };
  if (input.question_slot !== undefined) {
    payload.question_slot = input.question_slot;
  }
  if (input.target_date !== undefined) {
    payload.time_context = { target_date: input.target_date };
  }
  // cross_analysis — verbatim 패스스루 (산출은 computeCrossAnalysis, 점수 무개입 ADR-035)
  if (input.cross_analysis !== undefined) {
    payload.cross_analysis = input.cross_analysis;
  }
  return payload;
}
