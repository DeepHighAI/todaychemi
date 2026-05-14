import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type OpenAI from 'openai';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';

function loadSystemPrompt(): string {
  const promptPath = join(process.cwd(), 'prompts', 'system', 'daily_hap.md');
  return readFileSync(promptPath, 'utf-8');
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
    headline: raw.headline ?? '',
    headline_reason: raw.headline_reason ?? '',
    avoid_phrase: raw.avoid_phrase ?? '',
    avoid_phrase_reason: raw.avoid_phrase_reason ?? '',
    favorable_action: raw.favorable_action ?? '',
    favorable_action_reason: raw.favorable_action_reason ?? '',
    reused_from_yesterday: false,
  };
}
