import { describe, it, expect, vi } from 'vitest';
import type OpenAI from 'openai';
import type { ChartCore } from '@/types/chart';
import type { TodayLlmInput } from '@/lib/today/builder';

const mockCreate = vi.fn();

beforeEachReset();

function beforeEachReset() {
  // 기본 응답: 정상 JSON 카드
  mockCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            headline: '오늘의 사이',
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
}

const mockOpenai = {
  chat: { completions: { create: mockCreate } },
} as unknown as OpenAI;

const SELF_CHART: ChartCore = {
  year_pillar: '辛未',
  month_pillar: '癸卯',
  day_pillar: '甲戌',
  hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
  yunse: {
    daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 },
    seyun: { current_pillar: '병오', current_year: 2026 },
    wolun: { current_pillar: '계사', current_month: '2026-05' },
    iliun: { today_pillar: '갑자', today_date: '2026-05-28' },
  },
};

const REL_CHART: ChartCore = {
  ...SELF_CHART,
  year_pillar: '己卯',
  month_pillar: '庚辰',
  day_pillar: '辛巳',
  day_master_element: '금',
  five_elements_counts: { 목: 1, 화: 0, 토: 1, 금: 2, 수: 1 },
  gender_normalized: 'M',
};

function makeInput(relationChart: ChartCore | null = null): TodayLlmInput {
  return {
    self_chart: SELF_CHART,
    relation_chart: relationChart,
    today_date: '2026-05-28',
  };
}

describe('callDailyHapLlm — model + params (gpt-5)', () => {
  it('model 은 gpt-5 (G2 / Phase 3 C5 격상)', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai);
    expect(mockCreate.mock.calls[0][0].model).toBe('gpt-5');
  });

  it('max_completion_tokens 사용 (max_tokens 금지)', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload).toHaveProperty('max_completion_tokens');
    expect(payload).not.toHaveProperty('max_tokens');
  });

  it('temperature 파라미터 없음 (gpt-5 패밀리 미지원)', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai);
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('temperature');
  });

  it('reasoning_effort: "low" 포함', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai);
    expect(mockCreate.mock.calls[0][0].reasoning_effort).toBe('low');
  });

  it('LLM 응답 빈 필드 → 기본 fallback 채움', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              headline: ' ',
              headline_reason: '',
              avoid_phrase: '',
              avoid_phrase_reason: '   ',
              favorable_action: '',
              favorable_action_reason: '',
            }),
          },
        },
      ],
    });
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    const result = await callDailyHapLlm(makeInput(), mockOpenai);
    expect(result.headline).toBeTruthy();
    expect(result.avoid_phrase).toBe('급하게 단정하는 말');
    expect(result.favorable_action).toBe('가벼운 정리부터 하기');
  });
});

// G2 / Phase 3 C5 — 3축 페이로드 + 프롬프트 분기 + PII 0건
describe('callDailyHapLlm — 3축 인연 종합 (G2)', () => {
  it('relation_chart=null → user message 에 self_chart + today_date 만 (relation 미포함)', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(null), mockOpenai);
    const payload = mockCreate.mock.calls[0][0];
    const userMsg = payload.messages.find((m: { role: string }) => m.role === 'user');
    const userContent = JSON.parse(userMsg.content);
    expect(userContent.chart_core).toBeDefined();
    expect(userContent.today_date).toBe('2026-05-28');
    expect(userContent.relation_chart_core ?? null).toBeNull();
  });

  it('relation_chart 존재 → user message 에 relation_chart_core 포함', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(REL_CHART), mockOpenai);
    const userMsg = mockCreate.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === 'user',
    );
    const userContent = JSON.parse(userMsg.content);
    expect(userContent.chart_core).toBeDefined();
    expect(userContent.relation_chart_core).toBeDefined();
    expect(userContent.relation_chart_core.day_pillar).toBe('辛巳');
  });

  it('PII 0건 — user 페이로드에 nickname/relation_id/email/birth_date/birth_place 키 없음', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(REL_CHART), mockOpenai);
    // system prompt 본문은 PII 제약 설명에서 단어 자체를 포함할 수 있으므로,
    // 검사는 user 메시지(실제 LLM 입력 데이터)에 한정.
    const userMsg = mockCreate.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === 'user',
    );
    const userText = userMsg.content as string;
    expect(userText).not.toMatch(/nickname/i);
    expect(userText).not.toMatch(/relation_id/i);
    expect(userText).not.toMatch(/email/i);
    expect(userText).not.toMatch(/birth_date/i);
    expect(userText).not.toMatch(/birth_place/i);

    // 추가: user 페이로드는 chart_core / relation_chart_core / today_date 3 키만 허용
    const userObj = JSON.parse(userText);
    expect(Object.keys(userObj).sort()).toEqual(
      ['chart_core', 'relation_chart_core', 'today_date'].sort(),
    );
  });

  it('relation_chart 존재 시 system prompt 는 today_with_relation 사용', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(REL_CHART), mockOpenai);
    const sys = mockCreate.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === 'system',
    );
    // today_with_relation 프롬프트 식별 헤더 포함
    expect(sys.content).toMatch(/today.with.relation|오늘.*인연|Mode:\s*오늘합 \(today_with_relation\)/i);
  });

  it('relation_chart=null 시 system prompt 는 기존 daily_hap 사용', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(null), mockOpenai);
    const sys = mockCreate.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === 'system',
    );
    expect(sys.content).toMatch(/daily_hap|Mode:\s*오늘합 \(todayHap\)/i);
  });
});
