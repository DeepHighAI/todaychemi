import type { ChartCore, YunseCore } from '@/types/chart';
import type { Mode } from '@/types/mode';

// CLAUDE.md §5 — LLM 페이로드 화이트리스트:
// chart_core(self) + chart_core(relation) + mode + question_slot? + theory_profile.profile_version
// replay 전용: time_context (일진 날짜 — PII 아님, 모든 사용자 공통 공개 정보)
// 절대 포함 금지: birth_date, name, nickname, email, birth_place, raw gender,
// 점수 (compat_score, score_breakdown — ADR-035)

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

export interface LlmChartCore extends Omit<ChartCore, 'yunse'> {
  yunse: LlmYunse;
}

export interface LlmPayload {
  self_chart_core: LlmChartCore;
  relation_chart_core: LlmChartCore;
  mode: Mode;
  theory_profile: { profile_version: string };
  question_slot?: string;
  time_context?: { jinjin_date: string }; // replay 전용 (YYYY-MM-DD UTC+9)
}

export interface BuildLlmPayloadInput {
  self: ChartCore;
  relation: ChartCore;
  mode: Mode;
  theory_profile_version: string;
  question_slot?: string;
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

function projectChartForLlm(chart: ChartCore): LlmChartCore {
  return { ...chart, yunse: projectYunseForLlm(chart.yunse) };
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
  return payload;
}
