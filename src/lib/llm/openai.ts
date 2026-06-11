import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';
import { HapcardLlmOutputSchema, type HapcardLlmOutput } from '@/lib/llm/output-schema';
import {
  loadBannedPhrases,
  findBannedPhrase,
  findScoreLeak,
  containsClassicalHanja,
  type BannedPhraseCategory,
} from '@/lib/llm/banned-phrases';
import { DEFAULT_LLM_MODEL } from '@/lib/llm/constants';
import { retryOnce } from '@/lib/llm/retry';
import { callClaudeFallback, type AnthropicMessagesClient } from '@/lib/llm/anthropic';
import {
  isProviderUnhealthy,
  recordProviderFailure,
  recordProviderSuccess,
} from '@/lib/llm/circuit-breaker';
import { enforceDailyLlmBudget } from '@/lib/llm/budget';
import { toErrorMessage } from '@/lib/errors/to-message';
import { estimateLlmCostUsd } from '@/lib/llm/cost';
import type { LlmModel } from '@/types/hapcard';

// AGENTS.md §5 — hapcard 기본 PII 화이트리스트. callOpenAi에 payloadWhitelist 미제공 시 사용.
// time_context: 오늘 케미 target_date / replay 일진 날짜 (공개 정보, PII 아님)
// cross_analysis: 결정형 교차분석 facts — LLM 해석 근거 전용 (hapcard+replay 공용, ADR-035 점수 무개입)
export const HAPCARD_PAYLOAD_WHITELIST = new Set([
  'self_chart_core',
  'relation_chart_core',
  'mode',
  'theory_profile',
  'question_slot',
  'time_context',
  'cross_analysis',
]);

const FORBIDDEN_LLM_PAYLOAD_KEYS = new Set([
  'birth_date',
  'birth_time',
  'name',
  'nickname',
  'email',
  'birth_place',
  'gender',
]);

function normalizePayloadKeyForPiiGuard(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function isForbiddenLlmPayloadKey(key: string): boolean {
  const normalized = normalizePayloadKeyForPiiGuard(key);
  if (normalized === 'gender_normalized' || normalized.endsWith('_gender_normalized')) {
    return false;
  }

  if (FORBIDDEN_LLM_PAYLOAD_KEYS.has(normalized)) return true;

  return /(^|_)(birth_date|birth_time|name|nickname|email|birth_place|gender)($|_)/.test(
    normalized,
  );
}

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export interface CallOpenAiDeps {
  openaiClient: {
    chat: {
      completions: {
        create: (
          req: Record<string, unknown>,
          options?: { timeout?: number },
        ) => Promise<OpenAiChatResponse>;
      };
    };
  };
  supabaseServiceRole: SupabaseClient;
  now?: () => Date;
  anthropicClient?: AnthropicMessagesClient;
  // 테스트 주입용 — 미제공 시 banned_phrases_catalog.yaml 에서 로드
  bannedPhraseCatalog?: BannedPhraseCategory[];
}

export interface CallOpenAiInput<TOutput = HapcardLlmOutput> {
  systemPrompt: string;
  userPayload: object;
  // 미제공 시 hapcard 기본값 사용
  schema?: ZodType<TOutput>;
  payloadWhitelist?: ReadonlySet<string>;
  model?: string;
  maxCompletionTokens?: number;
  timeoutMs?: number;
}

export interface CallOpenAiResult<TOutput = HapcardLlmOutput> {
  output: TOutput;
  usage: { token_in: number; token_out: number; total_usd: number };
  model: string;
}

// 재시도 가능 여부 판별
function isRetryableError(err: unknown): boolean {
  if (err instanceof ZodError) return false;
  if (err instanceof Error) {
    const msg = err.message;
    // 4xx 인증/요청 오류 → 재시도 불가
    if (/\b4[0-9][0-9]\b/.test(msg) && !/429/.test(msg)) return false;
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) return false;
    if (msg.includes('400') && !msg.includes('429')) return false;
  }
  return true;
}

function validateLlmText<TOutput>(
  text: string,
  schema: ZodType<TOutput>,
  catalog: BannedPhraseCategory[],
): TOutput {
  // JSON parse 실패 → 재시도 가능
  const raw = JSON.parse(text);
  // Zod strict 위반 → ZodError → 재시도 불가
  const validated = schema.parse(raw) as TOutput;

  // banned-phrase + 점수 누설: raw text 검사 (schema 독립적)
  const banned = findBannedPhrase(text, catalog);
  if (banned.found) throw new Error(`BANNED_PHRASE: ${banned.phrase}`);

  const scoreLeak = findScoreLeak(text);
  if (scoreLeak.found) throw new Error(`BANNED_PHRASE: score_leak: ${scoreLeak.phrase}`);

  // ADR-038 Option C: 한자 누수 감지 시 warn-and-pass (UI safety-net이 최종 방어)
  const hanjaHit = containsClassicalHanja(text);
  if (hanjaHit.found) console.warn('[CLASSICAL_HANJA]', { phrase: hanjaHit.phrase });

  return validated;
}

function findForbiddenLlmPayloadKey(
  value: unknown,
  path = 'userPayload',
  seen = new WeakSet<object>(),
): string | null {
  if (value === null || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const nested = findForbiddenLlmPayloadKey(item, `${path}[${index}]`, seen);
      if (nested) return nested;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (isForbiddenLlmPayloadKey(key)) return nextPath;
    const nested = findForbiddenLlmPayloadKey(nestedValue, nextPath, seen);
    if (nested) return nested;
  }
  return null;
}

export async function callOpenAi<TOutput = HapcardLlmOutput>(
  input: CallOpenAiInput<TOutput>,
  deps: CallOpenAiDeps,
): Promise<CallOpenAiResult<TOutput>> {
  const schema = (input.schema ?? HapcardLlmOutputSchema) as ZodType<TOutput>;
  const whitelist = input.payloadWhitelist ?? HAPCARD_PAYLOAD_WHITELIST;
  const model = (input.model ?? DEFAULT_LLM_MODEL) as LlmModel;

  // PII 가드 (AGENTS.md §5)
  for (const key of Object.keys(input.userPayload as Record<string, unknown>)) {
    if (!whitelist.has(key)) {
      throw new Error(`PII_GUARD_VIOLATION: ${key}`);
    }
  }
  const forbiddenKeyPath = findForbiddenLlmPayloadKey(input.userPayload);
  if (forbiddenKeyPath) {
    throw new Error(`PII_GUARD_VIOLATION: ${forbiddenKeyPath}`);
  }

  const catalog = deps.bannedPhraseCatalog ?? loadBannedPhrases();
  const now = deps.now?.() ?? new Date();

  await enforceDailyLlmBudget(deps.supabaseServiceRole, now);

  let tokenIn = 0;
  let tokenOut = 0;

  const parseAndValidate = async (): Promise<TOutput> => {
    const request = {
      model,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: JSON.stringify(input.userPayload) },
      ],
      response_format: { type: 'json_object' },
      store: false,
      reasoning_effort: 'low',
      max_completion_tokens: input.maxCompletionTokens ?? 4000,
    };
    const options = input.timeoutMs === undefined ? undefined : { timeout: input.timeoutMs };
    const response = await deps.openaiClient.chat.completions.create(request, options);

    tokenIn = response.usage.prompt_tokens;
    tokenOut = response.usage.completion_tokens;

    const text = response.choices[0].message.content ?? '';
    return validateLlmText(text, schema, catalog);
  };

  let output: TOutput;
  let provider: 'openai' | 'anthropic' = 'openai';
  let trackedModel: LlmModel = model;
  try {
    if (isProviderUnhealthy('openai', now)) {
      throw new Error('OPENAI_PROVIDER_UNHEALTHY: fallback_to_claude');
    }
    output = await retryOnce(parseAndValidate, { isRetryable: isRetryableError });
    recordProviderSuccess('openai');
  } catch (err) {
    // banned-phrase 위반이 재시도 후에도 지속 → 표준 오류 코드로 변환
    if (err instanceof Error && err.message.startsWith('BANNED_PHRASE:')) {
      throw new Error(`BANNED_PHRASE_DETECTED: ${err.message.slice('BANNED_PHRASE:'.length).trim()}`);
    }

    if (!isRetryableError(err) && !(err instanceof Error && err.message.startsWith('OPENAI_PROVIDER_UNHEALTHY'))) {
      throw err;
    }

    recordProviderFailure('openai', now);

    try {
      const fallback = await callClaudeFallback(
        { systemPrompt: input.systemPrompt, userPayload: input.userPayload },
        deps,
      );
      tokenIn = fallback.tokenIn;
      tokenOut = fallback.tokenOut;
      output = validateLlmText(fallback.text, schema, catalog);
      provider = 'anthropic';
      trackedModel = 'claude-fallback';
    } catch (fallbackErr) {
      throw new Error(`LLM_ALL_PROVIDERS_DOWN: ${toErrorMessage(err)} / ${toErrorMessage(fallbackErr)}`);
    }
  }

  const totalUsd = await trackCost(deps.supabaseServiceRole, now, tokenIn, tokenOut, trackedModel, provider);

  return { output, usage: { token_in: tokenIn, token_out: tokenOut, total_usd: totalUsd }, model: trackedModel };
}

async function trackCost(
  client: SupabaseClient,
  now: Date,
  tokenIn: number,
  tokenOut: number,
  model: LlmModel,
  provider: 'openai' | 'anthropic' = 'openai',
): Promise<number> {
  const date = now.toISOString().slice(0, 10);
  const totalUsd = estimateLlmCostUsd(provider, model, tokenIn, tokenOut);

  const { data: existing } = await client
    .from('llm_cost_tracking')
    .select('call_count, token_in, token_out, total_usd')
    .eq('date', date)
    .eq('provider', provider)
    .eq('model', model)
    .maybeSingle();

  const { error } = await client.from('llm_cost_tracking').upsert({
    date,
    provider,
    model,
    total_usd: Number(((existing as { total_usd?: number | string } | null)?.total_usd ?? 0)) + totalUsd,
    call_count: ((existing as { call_count?: number } | null)?.call_count ?? 0) + 1,
    token_in: ((existing as { token_in?: number } | null)?.token_in ?? 0) + tokenIn,
    token_out: ((existing as { token_out?: number } | null)?.token_out ?? 0) + tokenOut,
  }, { onConflict: 'date,provider,model' });
  if (error) {
    throw new Error(`LLM_COST_TRACKING_FAILED: ${error.message}`);
  }

  return totalUsd;
}

// Backward-compatible re-export. The canonical factory enforces production
// OPENAI_PROJECT_ID routing and SDK timeout settings.
export { createOpenAiClient } from '@/lib/llm/clients';
