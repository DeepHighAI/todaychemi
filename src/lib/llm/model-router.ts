import type { LlmModel } from '@/types/hapcard';

export type LlmFlow = 'hapcard' | 'replay' | 'today' | 'deep-report';

// G2 / Phase 3 C5 (2026-05-28): today gpt-5-mini → gpt-5 격상.
// 인연 종합 해석 깊이 ↑ 위해 사용자 §1.1 확정.
const LLM_MODEL_BY_FLOW = {
  hapcard: 'gpt-5',
  replay: 'gpt-5',
  today: 'gpt-5',
  'deep-report': 'gpt-5',
} satisfies Record<LlmFlow, LlmModel>;

export function selectLlmModel(flow: LlmFlow): LlmModel {
  return LLM_MODEL_BY_FLOW[flow];
}
