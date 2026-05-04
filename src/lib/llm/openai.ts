import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { HapcardLlmOutputSchema, type HapcardLlmOutput } from '@/lib/llm/output-schema';
import type { LlmPayload } from '@/lib/llm/payload';
import {
  loadBannedPhrases,
  findBannedPhrase,
  findScoreLeak,
  type BannedPhraseCategory,
} from '@/lib/llm/banned-phrases';
import { retryOnce } from '@/lib/llm/retry';

// CLAUDE.md §5 — PII 화이트리스트. 이 키 외 발견 시 즉시 중단.
const PAYLOAD_WHITELIST = new Set([
  'self_chart_core',
  'relation_chart_core',
  'mode',
  'theory_profile',
  'question_slot',
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

export interface CallOpenAiInput {
  systemPrompt: string;
  userPayload: LlmPayload;
}

export interface CallOpenAiResult {
  output: HapcardLlmOutput;
  usage: { token_in: number; token_out: number; total_usd: number };
  model: 'gpt-5o';
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

export async function callOpenAi(
  input: CallOpenAiInput,
  deps: CallOpenAiDeps,
): Promise<CallOpenAiResult> {
  // PII 가드 (CLAUDE.md §5)
  for (const key of Object.keys(input.userPayload)) {
    if (!PAYLOAD_WHITELIST.has(key)) {
      throw new Error(`PII_GUARD_VIOLATION: ${key}`);
    }
  }

  const catalog = deps.bannedPhraseCatalog ?? loadBannedPhrases();

  let tokenIn = 0;
  let tokenOut = 0;

  const parseAndValidate = async (): Promise<HapcardLlmOutput> => {
    const response = await deps.openaiClient.chat.completions.create({
      model: 'gpt-5o',
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
    const validated = HapcardLlmOutputSchema.parse(raw);

    // banned-phrase + 점수 누설 검사
    const joined = [
      validated.main_text,
      ...validated.cause_factors.map((f) => `${f.name} ${f.effect}`),
      ...validated.actions,
      ...validated.why_cards.map((c) => `${c.title} ${c.reason}`),
    ].join(' ');

    const banned = findBannedPhrase(joined, catalog);
    if (banned.found) throw new Error(`BANNED_PHRASE: ${banned.phrase}`);

    const scoreLeak = findScoreLeak(joined);
    if (scoreLeak.found) throw new Error(`BANNED_PHRASE: score_leak: ${scoreLeak.phrase}`);

    return validated;
  };

  let output: HapcardLlmOutput;
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
  await trackCost(deps.supabaseServiceRole, deps.now?.() ?? new Date(), tokenIn, tokenOut);

  return { output, usage: { token_in: tokenIn, token_out: tokenOut, total_usd: 0 }, model: 'gpt-5o' };
}

async function trackCost(
  client: SupabaseClient,
  now: Date,
  tokenIn: number,
  tokenOut: number,
): Promise<void> {
  const date = now.toISOString().slice(0, 10);

  const { data: existing } = await client
    .from('llm_cost_tracking')
    .select('call_count, token_in, token_out')
    .eq('date', date)
    .eq('provider', 'openai')
    .eq('model', 'gpt-5o')
    .maybeSingle();

  await client.from('llm_cost_tracking').upsert({
    date,
    provider: 'openai',
    model: 'gpt-5o',
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
