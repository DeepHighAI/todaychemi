import type { LlmModel } from '@/types/hapcard';

export type LlmFlow = 'hapcard' | 'replay' | 'today' | 'deep-report';

const LLM_MODEL_BY_FLOW = {
  hapcard: 'gpt-5o',
  replay: 'gpt-5o',
  today: 'gpt-5-mini',
  'deep-report': 'gpt-5',
} satisfies Record<LlmFlow, LlmModel>;

export function selectLlmModel(flow: LlmFlow): LlmModel {
  return LLM_MODEL_BY_FLOW[flow];
}
