import type { LlmModel } from '@/types/hapcard';

type Provider = 'openai' | 'anthropic';

interface ModelRate {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

const RATES: Record<Provider, Partial<Record<LlmModel, ModelRate>>> = {
  openai: {
    'gpt-5': { inputUsdPerMillion: 1.25, outputUsdPerMillion: 10 },
    'gpt-5-mini': { inputUsdPerMillion: 0.25, outputUsdPerMillion: 2 },
    'gpt-5o': { inputUsdPerMillion: 1.25, outputUsdPerMillion: 10 },
  },
  anthropic: {
    'claude-fallback': { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  },
};

export function estimateLlmCostUsd(
  provider: Provider,
  model: LlmModel,
  tokenIn: number,
  tokenOut: number,
): number {
  const rate = RATES[provider][model];
  if (!rate) return 0;

  const total =
    (tokenIn / 1_000_000) * rate.inputUsdPerMillion +
    (tokenOut / 1_000_000) * rate.outputUsdPerMillion;
  return Number(total.toFixed(6));
}
