import { describe, it, expect, vi } from 'vitest';
import type OpenAI from 'openai';

const mockCreate = vi.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: JSON.stringify({
          headline: '오늘의 합',
          headline_reason: '이유',
          avoid_phrase: '비난',
          avoid_phrase_reason: '갈등',
          favorable_action: '먼저 인사',
          favorable_action_reason: '관계',
        }),
      },
    },
  ],
});

const mockOpenai = {
  chat: { completions: { create: mockCreate } },
} as unknown as OpenAI;

describe('callDailyHapLlm — gpt-5-mini params', () => {
  it('max_completion_tokens 사용 (max_tokens 금지)', async () => {
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    const chart = {
      year_pillar: '辛未', month_pillar: '癸卯', day_pillar: '甲戌', hour_pillar: null,
      day_master_element: '목' as const,
      five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
      gender_normalized: 'F' as const, yunse: null,
    };
    await callDailyHapLlm(chart as unknown as Parameters<typeof callDailyHapLlm>[0], mockOpenai);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload).toHaveProperty('max_completion_tokens');
    expect(payload).not.toHaveProperty('max_tokens');
  });

  it('temperature 파라미터 없음 (gpt-5 패밀리 미지원)', async () => {
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    const chart = {
      year_pillar: '辛未', month_pillar: '癸卯', day_pillar: '甲戌', hour_pillar: null,
      day_master_element: '목' as const,
      five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
      gender_normalized: 'F' as const, yunse: null,
    };
    mockCreate.mockClear();
    await callDailyHapLlm(chart as unknown as Parameters<typeof callDailyHapLlm>[0], mockOpenai);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload).not.toHaveProperty('temperature');
  });

  it('reasoning_effort: "low" 포함', async () => {
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    const chart = {
      year_pillar: '辛未', month_pillar: '癸卯', day_pillar: '甲戌', hour_pillar: null,
      day_master_element: '목' as const,
      five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
      gender_normalized: 'F' as const, yunse: null,
    };
    mockCreate.mockClear();
    await callDailyHapLlm(chart as unknown as Parameters<typeof callDailyHapLlm>[0], mockOpenai);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.reasoning_effort).toBe('low');
  });
});
