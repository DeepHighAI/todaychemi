import type { CallOpenAiDeps } from '@/lib/llm/openai';

export interface AnthropicMessageResponse {
  content: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface AnthropicMessagesClient {
  messages: {
    create: (req: Record<string, unknown>) => Promise<AnthropicMessageResponse>;
  };
}

export const CLAUDE_FALLBACK_MODEL = process.env.ANTHROPIC_FALLBACK_MODEL ?? 'claude-sonnet-4-5';

export function createAnthropicClient(): AnthropicMessagesClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('LLM_ALL_PROVIDERS_DOWN: ANTHROPIC_API_KEY is required for Claude fallback');
  }

  const { default: Anthropic } = require('@anthropic-ai/sdk') as {
    default: new (opts: { apiKey: string }) => AnthropicMessagesClient;
  };
  return new Anthropic({ apiKey });
}

export async function callClaudeFallback(
  input: { systemPrompt: string; userPayload: object },
  deps: Pick<CallOpenAiDeps, 'anthropicClient'>,
): Promise<{ text: string; tokenIn: number; tokenOut: number }> {
  const anthropic = deps.anthropicClient ?? createAnthropicClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_FALLBACK_MODEL,
    system: input.systemPrompt,
    messages: [{ role: 'user', content: JSON.stringify(input.userPayload) }],
    max_tokens: 4000,
  });

  const text = response.content
    .map((part) => (part.type === 'text' || !part.type ? part.text ?? '' : ''))
    .join('')
    .trim();

  return {
    text,
    tokenIn: response.usage?.input_tokens ?? 0,
    tokenOut: response.usage?.output_tokens ?? 0,
  };
}
