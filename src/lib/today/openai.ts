import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type OpenAI from 'openai';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';

function loadSystemPrompt(): string {
  const promptPath = join(process.cwd(), 'prompts', 'system', 'daily_hap.md');
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

export async function callDailyHapLlm(chart: ChartCore, openai: OpenAI): Promise<DailyHapCard> {
  const systemPrompt = loadSystemPrompt();

  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify({ chart_core: chart }) },
    ],
    response_format: { type: 'json_object' },
    store: false,
    reasoning_effort: 'low',
    max_completion_tokens: 800,
  });

  const text = response.choices[0].message.content ?? '{}';
  const raw = JSON.parse(text) as Partial<DailyHapCard>;

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
