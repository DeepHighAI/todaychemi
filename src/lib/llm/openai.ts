import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';
import { HapcardLlmOutputSchema, type HapcardLlmOutput } from '@/lib/llm/output-schema';
import {
  loadBannedPhrases,
  findBannedPhrase,
  findScoreLeak,
  type BannedPhraseCategory,
} from '@/lib/llm/banned-phrases';
import { DEFAULT_LLM_MODEL } from '@/lib/llm/constants';
import { retryOnce } from '@/lib/llm/retry';

// CLAUDE.md §5 — hapcard 기본 PII 화이트리스트. callOpenAi에 payloadWhitelist 미제공 시 사용.
// time_context: replay 전용 일진 날짜 (공개 정보, PII 아님)
export const HAPCARD_PAYLOAD_WHITELIST = new Set([
  'self_chart_core',
  'relation_chart_core',
  'mode',
  'theory_profile',
  'question_slot',
  'time_context',
]);

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export interface CallOpenAiDeps {
  openaiClient: {
    chat: {
      completions: {
        create: (req: Record<string, unknown>) => Promise<OpenAiChatResponse>;
      };
    };
  };
  supabaseServiceRole: SupabaseClient;
  now?: () => Date;
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

export async function callOpenAi<TOutput = HapcardLlmOutput>(
  input: CallOpenAiInput<TOutput>,
  deps: CallOpenAiDeps,
): Promise<CallOpenAiResult<TOutput>> {
  const schema = (input.schema ?? HapcardLlmOutputSchema) as ZodType<TOutput>;
  const whitelist = input.payloadWhitelist ?? HAPCARD_PAYLOAD_WHITELIST;
  const model = input.model ?? DEFAULT_LLM_MODEL;

  // PII 가드 (CLAUDE.md §5)
  for (const key of Object.keys(input.userPayload as Record<string, unknown>)) {
    if (!whitelist.has(key)) {
      throw new Error(`PII_GUARD_VIOLATION: ${key}`);
    }
  }

  const catalog = deps.bannedPhraseCatalog ?? loadBannedPhrases();

  let tokenIn = 0;
  let tokenOut = 0;

  const parseAndValidate = async (): Promise<TOutput> => {
    const response = await deps.openaiClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: JSON.stringify(input.userPayload) },
      ],
      response_format: { type: 'json_object' },
      store: false,
    });

    tokenIn = response.usage.prompt_tokens;
    tokenOut = response.usage.completion_tokens;

    const text = response.choices[0].message.content ?? '';
    // JSON parse 실패 → 재시도 가능
    const raw = JSON.parse(text);
    // Zod strict 위반 → ZodError → 재시도 불가
    const validated = schema.parse(raw) as TOutput;

    // banned-phrase + 점수 누설: raw text 검사 (schema 독립적)
    const banned = findBannedPhrase(text, catalog);
    if (banned.found) throw new Error(`BANNED_PHRASE: ${banned.phrase}`);

    const scoreLeak = findScoreLeak(text);
    if (scoreLeak.found) throw new Error(`BANNED_PHRASE: score_leak: ${scoreLeak.phrase}`);

    return validated;
  };

  let output: TOutput;
  try {
    output = await retryOnce(parseAndValidate, { isRetryable: isRetryableError });
  } catch (err) {
    // banned-phrase 위반이 재시도 후에도 지속 → 표준 오류 코드로 변환
    if (err instanceof Error && err.message.startsWith('BANNED_PHRASE:')) {
      throw new Error(`BANNED_PHRASE_DETECTED: ${err.message.slice('BANNED_PHRASE:'.length).trim()}`);
    }
    throw err;
  }

  // 비용 추적 UPSERT — D2: total_usd=0 (토큰 단가 미확정)
  await trackCost(deps.supabaseServiceRole, deps.now?.() ?? new Date(), tokenIn, tokenOut, model);

  return { output, usage: { token_in: tokenIn, token_out: tokenOut, total_usd: 0 }, model };
}

async function trackCost(
  client: SupabaseClient,
  now: Date,
  tokenIn: number,
  tokenOut: number,
  model: string,
): Promise<void> {
  const date = now.toISOString().slice(0, 10);

  const { data: existing } = await client
    .from('llm_cost_tracking')
    .select('call_count, token_in, token_out')
    .eq('date', date)
    .eq('provider', 'openai')
    .eq('model', model)
    .maybeSingle();

  await client.from('llm_cost_tracking').upsert({
    date,
    provider: 'openai',
    model,
    total_usd: 0,
    call_count: ((existing as { call_count?: number } | null)?.call_count ?? 0) + 1,
    token_in: ((existing as { token_in?: number } | null)?.token_in ?? 0) + tokenIn,
    token_out: ((existing as { token_out?: number } | null)?.token_out ?? 0) + tokenOut,
  }, { onConflict: 'date,provider,model' });
}

// 실제 OpenAI SDK 인스턴스 팩토리 (의존성 없는 환경용)
export function createOpenAiClient(): CallOpenAiDeps['openaiClient'] {
  const { default: OpenAI } = require('openai') as { default: new (opts: Record<string, unknown>) => CallOpenAiDeps['openaiClient'] };
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    project: process.env.OPENAI_PROJECT_ID,
  });
}
