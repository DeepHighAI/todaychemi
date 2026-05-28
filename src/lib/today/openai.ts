import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type OpenAI from 'openai';
import type { DailyHapCard } from '@/types/dailyHap';
import type { TodayLlmInput } from '@/lib/today/builder';
import { selectLlmModel } from '@/lib/llm/model-router';

// Task 1: 오늘카드 LLM-only timeout. 60s SDK 기본 → 25s 로 단축.
// (전체 today 응답 시간 ≤ 30s 목표. KASI compute + DB save 가 약 5s 여유.)
export const TODAY_LLM_TIMEOUT_MS = 25_000;

function loadSystemPrompt(relationPresent: boolean): string {
  const filename = relationPresent ? 'today_with_relation.md' : 'daily_hap.md';
  const promptPath = join(process.cwd(), 'prompts', 'system', filename);
  return readFileSync(promptPath, 'utf-8');
}

const FALLBACK_FIELDS = {
  headline: '오늘 메시지를 준비하지 못했어요. 내일 다시 찾아주세요.',
  headline_reason: '오늘 해석 데이터를 불러오지 못해 안전한 기본 안내를 보여드려요.',
  avoid_phrase: '급하게 단정하는 말',
  avoid_phrase_reason: '오늘은 개인 맞춤 해석이 준비되지 않아 중요한 판단을 서두르지 않는 편이 안전해요.',
  favorable_action: '가벼운 정리부터 하기',
  favorable_action_reason: '새로운 해석이 없을 때는 일정과 마음을 먼저 정돈하면 하루 흐름을 안정적으로 가져갈 수 있어요.',
} satisfies Omit<DailyHapCard, 'reused_from_yesterday'>;

function textOrFallback(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

// G2 / Phase 3 C5 — 3축 (self + relation + today_date) 인터페이스 + GPT-5 격상.
// relation_chart 가 null 이면 기존 daily_hap.md 프롬프트 + 단일축 페이로드 (인연 미등록 사용자).
// relation_chart 존재 시 today_with_relation.md 프롬프트 + relation_chart_core 포함 페이로드.
// PII 0건 — relation 의 nickname/relation_id/email/birth_date 절대 포함 금지.
//
// Task 1 (Phase 3 후속):
//   - LLM-only 25s timeout 명시 (SDK 기본 60s 단축)
//   - timeout / parse 에러를 LLM_TIMEOUT / LLM_PARSE_FAIL prefix 로 wrap 하여
//     builder.ts measure catch 와 route.ts classify 가 분류할 수 있게 한다.
export async function callDailyHapLlm(
  input: TodayLlmInput,
  openai: OpenAI,
): Promise<DailyHapCard> {
  const relationPresent = input.relation_chart !== null;
  const systemPrompt = loadSystemPrompt(relationPresent);

  // PII 0건 페이로드 (chart_core 만 + today_date)
  const userPayload = relationPresent
    ? {
        chart_core: input.self_chart,
        relation_chart_core: input.relation_chart,
        today_date: input.today_date,
      }
    : {
        chart_core: input.self_chart,
        today_date: input.today_date,
      };

  let response;
  try {
    response = await openai.chat.completions.create(
      {
        model: selectLlmModel('today'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        response_format: { type: 'json_object' },
        store: false,
        reasoning_effort: 'low',
        max_completion_tokens: 800,
      },
      { timeout: TODAY_LLM_TIMEOUT_MS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout|aborted|timed out/i.test(msg)) {
      throw new Error(`LLM_TIMEOUT: ${msg}`);
    }
    throw err;
  }

  const text = response.choices[0].message.content ?? '{}';
  let raw: Partial<DailyHapCard>;
  try {
    raw = JSON.parse(text) as Partial<DailyHapCard>;
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    throw new Error(`LLM_PARSE_FAIL: ${msg}`);
  }

  return {
    headline: textOrFallback(raw.headline, FALLBACK_FIELDS.headline),
    headline_reason: textOrFallback(raw.headline_reason, FALLBACK_FIELDS.headline_reason),
    avoid_phrase: textOrFallback(raw.avoid_phrase, FALLBACK_FIELDS.avoid_phrase),
    avoid_phrase_reason: textOrFallback(raw.avoid_phrase_reason, FALLBACK_FIELDS.avoid_phrase_reason),
    favorable_action: textOrFallback(raw.favorable_action, FALLBACK_FIELDS.favorable_action),
    favorable_action_reason: textOrFallback(raw.favorable_action_reason, FALLBACK_FIELDS.favorable_action_reason),
    reused_from_yesterday: false,
  };
}
