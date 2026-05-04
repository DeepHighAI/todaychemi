import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';

// CLAUDE.md §5 — LLM 페이로드 화이트리스트:
// chart_core(self) + chart_core(relation) + mode + question_slot? + theory_profile.profile_version
// 절대 포함 금지: birth_date, name, nickname, email, birth_place, raw gender,
// 점수 (compat_score, score_breakdown — ADR-035)

export interface LlmPayload {
  self_chart_core: ChartCore;
  relation_chart_core: ChartCore;
  mode: Mode;
  theory_profile: { profile_version: string };
  question_slot?: string;
}

export interface BuildLlmPayloadInput {
  self: ChartCore;
  relation: ChartCore;
  mode: Mode;
  theory_profile_version: string;
  question_slot?: string;
}

export function buildLlmPayload(input: BuildLlmPayloadInput): LlmPayload {
  const payload: LlmPayload = {
    self_chart_core: input.self,
    relation_chart_core: input.relation,
    mode: input.mode,
    theory_profile: { profile_version: input.theory_profile_version },
  };
  if (input.question_slot !== undefined) {
    payload.question_slot = input.question_slot;
  }
  return payload;
}
