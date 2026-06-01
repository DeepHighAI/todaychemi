import { describe, it, expect, vi, beforeEach } from 'vitest';
import type OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChartCore } from '@/types/chart';
import type { TodayLlmInput } from '@/lib/today/builder';

// Task 2 / ADR-008: prompt 본문은 prompt_versions DB row 에서 fetch.
// loadPromptForUser 를 mock 하여 본문 (canary or active) 를 주입.
vi.mock('@/lib/llm/prompt-loader', () => ({
  loadPromptForUser: vi.fn(),
}));
import { loadPromptForUser } from '@/lib/llm/prompt-loader';
import { resetLlmCircuitBreakersForTest } from '@/lib/llm/circuit-breaker';

const TODAY_WITH_RELATION_PROMPT = `# System Prompt — 오늘합 + 인연 종합 (today_with_relation)
> Mode: 오늘합 (today_with_relation)
> Version: v0.1
본문 placeholder.`;

const DAILY_HAP_PROMPT = `# System Prompt — 오늘합 (daily_hap)
> Mode: 오늘합 (todayHap)
> Version: v0.3
본문 placeholder.`;

const mockCreate = vi.fn();
const costUpsertMock = vi.fn();
const costMaybeSingleMock = vi.fn();
const budgetEqMock = vi.fn();
const mockSupabase = makeMockServiceClient();
const TEST_USER_ID = 'test-user-001';

function makeOpenAiResponse(content: string, tokenIn = 100, tokenOut = 200) {
  return {
    choices: [{ message: { content } }],
    usage: {
      prompt_tokens: tokenIn,
      completion_tokens: tokenOut,
      total_tokens: tokenIn + tokenOut,
    },
  };
}

function makeMockServiceClient(): SupabaseClient {
  const eqLevel3 = { maybeSingle: costMaybeSingleMock };
  const eqLevel2 = { eq: vi.fn().mockReturnValue(eqLevel3) };
  const eqLevel1 = { eq: vi.fn().mockReturnValue(eqLevel2) };
  const selectResult = { eq: vi.fn().mockReturnValue(eqLevel1) };
  const select = vi.fn((columns: string) => {
    if (columns === 'total_usd') return { eq: budgetEqMock };
    return selectResult;
  });

  return {
    from: vi.fn().mockReturnValue({
      select,
      upsert: costUpsertMock,
    }),
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  beforeEachReset();
  delete process.env.LLM_DAILY_BUDGET_USD;
  resetLlmCircuitBreakersForTest();
  costUpsertMock.mockReset().mockResolvedValue({ data: null, error: null });
  costMaybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null });
  budgetEqMock.mockReset().mockResolvedValue({ data: [], error: null });
  (loadPromptForUser as ReturnType<typeof vi.fn>).mockImplementation(
    async (_client: SupabaseClient, promptName: string, _userId: string) => ({
      prompt_name: promptName,
      version: promptName === 'today_with_relation' ? 'v0.1' : 'v0.3',
      content:
        promptName === 'today_with_relation'
          ? TODAY_WITH_RELATION_PROMPT
          : DAILY_HAP_PROMPT,
      status: 'active',
      canary_ratio: 0,
      notes: null,
      created_at: '2026-05-28T00:00:00Z',
    }),
  );
});

function beforeEachReset() {
  mockCreate.mockReset();
  // 기본 응답: 정상 JSON 카드
  mockCreate.mockResolvedValue(makeOpenAiResponse(JSON.stringify({
    headline: '오늘의 사이',
    headline_reason: '이유',
    avoid_phrase: '비난',
    avoid_phrase_reason: '갈등',
    favorable_action: '먼저 인사',
    favorable_action_reason: '관계',
  })));
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
    await callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID);
    expect(mockCreate.mock.calls[0][0].model).toBe('gpt-5');
  });

  it('max_completion_tokens 사용 (max_tokens 금지)', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload).toHaveProperty('max_completion_tokens');
    expect(payload).not.toHaveProperty('max_tokens');
  });

  // Regression: ISSUE-001 — bump max_completion_tokens 800 → 2000
  // Found by /qa on 2026-05-28
  // Report: .gstack/qa-reports/qa-report-localhost-3000-2026-05-28.md
  // GPT-5 reasoning + JSON output 합이 800 한도에서 잘림 → LLM_PARSE_FAIL → TEMPLATE fallback.
  // 800 으로 회귀하면 위 시나리오 재발생.
  it('max_completion_tokens >= 2000 (ISSUE-001 회귀 방지)', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.max_completion_tokens).toBeGreaterThanOrEqual(2000);
  });

  it('temperature 파라미터 없음 (gpt-5 패밀리 미지원)', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID);
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('temperature');
  });

  it('reasoning_effort: "low" 포함', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID);
    expect(mockCreate.mock.calls[0][0].reasoning_effort).toBe('low');
  });

  it('LLM 응답 빈 필드 → 기본 fallback 채움', async () => {
    mockCreate.mockResolvedValueOnce(makeOpenAiResponse(JSON.stringify({
      headline: ' ',
      headline_reason: '',
      avoid_phrase: '',
      avoid_phrase_reason: '   ',
      favorable_action: '',
      favorable_action_reason: '',
    })));
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    const result = await callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID);
    expect(result.headline).toBeTruthy();
    expect(result.avoid_phrase).toBe('급하게 단정하는 말');
    expect(result.favorable_action).toBe('가벼운 정리부터 하기');
  });

  it('성공 응답 → llm_cost_tracking 에 today 모델 비용을 기록', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID, {
      bannedPhraseCatalog: [],
    });

    expect(costUpsertMock).toHaveBeenCalledTimes(1);
    expect(costUpsertMock.mock.calls[0][0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5',
      total_usd: 0.002125,
      call_count: 1,
      token_in: 100,
      token_out: 200,
    });
  });

  it('LLM_DAILY_BUDGET_USD 초과 → OpenAI 호출 전 USER_QUOTA_EXCEEDED', async () => {
    process.env.LLM_DAILY_BUDGET_USD = '1';
    budgetEqMock.mockResolvedValueOnce({ data: [{ total_usd: 1.2 }], error: null });
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');

    await expect(
      callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID, {
        bannedPhraseCatalog: [],
        now: () => new Date('2026-05-31T00:00:00Z'),
      }),
    ).rejects.toThrow('USER_QUOTA_EXCEEDED');

    expect(mockCreate).not.toHaveBeenCalled();
    expect(costUpsertMock).not.toHaveBeenCalled();
  });

  it('OpenAI 5xx 2회 실패 → Claude fallback 으로 today 카드 생성', async () => {
    const anthropicCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            headline: 'fallback headline',
            headline_reason: 'fallback reason',
            avoid_phrase: 'fallback avoid',
            avoid_phrase_reason: 'fallback avoid reason',
            favorable_action: 'fallback action',
            favorable_action_reason: 'fallback action reason',
          }),
        },
      ],
      usage: { input_tokens: 90, output_tokens: 140 },
    });
    mockCreate.mockRejectedValue(new Error('500 Internal Server Error'));
    const { callDailyHapLlm } = await import('@/lib/today/openai');

    const result = await callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID, {
      anthropicClient: { messages: { create: anthropicCreate } },
      bannedPhraseCatalog: [],
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(anthropicCreate).toHaveBeenCalledTimes(1);
    expect(result.headline).toBe('fallback headline');
    expect(costUpsertMock.mock.calls[0][0]).toMatchObject({
      provider: 'anthropic',
      model: 'claude-fallback',
    });
  });

  it('timeout 계열 provider 오류는 LLM_TIMEOUT 으로 분류 유지', async () => {
    mockCreate.mockRejectedValue(new Error('Request timed out'));
    const anthropicCreate = vi.fn().mockRejectedValue(new Error('fallback unavailable'));
    const { callDailyHapLlm } = await import('@/lib/today/openai');

    await expect(
      callDailyHapLlm(makeInput(), mockOpenai, mockSupabase, TEST_USER_ID, {
        anthropicClient: { messages: { create: anthropicCreate } },
        bannedPhraseCatalog: [],
      }),
    ).rejects.toThrow('LLM_TIMEOUT');
  });
});

// G2 / Phase 3 C5 — 3축 페이로드 + 프롬프트 분기 + PII 0건
describe('callDailyHapLlm — 3축 인연 종합 (G2)', () => {
  it('relation_chart=null → user message 에 self_chart + today_date 만 (relation 미포함)', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(null), mockOpenai, mockSupabase, TEST_USER_ID);
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
    await callDailyHapLlm(makeInput(REL_CHART), mockOpenai, mockSupabase, TEST_USER_ID);
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
    await callDailyHapLlm(makeInput(REL_CHART), mockOpenai, mockSupabase, TEST_USER_ID);
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
    await callDailyHapLlm(makeInput(REL_CHART), mockOpenai, mockSupabase, TEST_USER_ID);
    const sys = mockCreate.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === 'system',
    );
    // today_with_relation 프롬프트 식별 헤더 포함
    expect(sys.content).toMatch(/today.with.relation|오늘.*인연|Mode:\s*오늘합 \(today_with_relation\)/i);
  });

  it('relation_chart=null 시 system prompt 는 기존 daily_hap 사용', async () => {
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(null), mockOpenai, mockSupabase, TEST_USER_ID);
    const sys = mockCreate.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === 'system',
    );
    expect(sys.content).toMatch(/daily_hap|Mode:\s*오늘합 \(todayHap\)/i);
  });
});

// Task 2 / ADR-008 — DB-backed prompt loading + canary 라우팅 통합
describe('callDailyHapLlm — DB-backed prompt loading (Task 2)', () => {
  it('relation_chart=null → loadPromptForUser 호출 시 promptName=daily_hap, userId 전파', async () => {
    mockCreate.mockClear();
    (loadPromptForUser as ReturnType<typeof vi.fn>).mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(null), mockOpenai, mockSupabase, 'user-xyz');
    expect(loadPromptForUser).toHaveBeenCalledOnce();
    const args = (loadPromptForUser as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[1]).toBe('daily_hap');
    expect(args[2]).toBe('user-xyz');
  });

  it('relation_chart 존재 → loadPromptForUser 호출 시 promptName=today_with_relation', async () => {
    mockCreate.mockClear();
    (loadPromptForUser as ReturnType<typeof vi.fn>).mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(REL_CHART), mockOpenai, mockSupabase, 'user-abc');
    const args = (loadPromptForUser as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[1]).toBe('today_with_relation');
    expect(args[2]).toBe('user-abc');
  });

  it('canary row 반환 시 그 본문이 system prompt 로 사용됨', async () => {
    (loadPromptForUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      prompt_name: 'today_with_relation',
      version: 'v0.2',
      content: '# CANARY VARIANT v0.2\n새 본문',
      status: 'canary',
      canary_ratio: 0.05,
      notes: null,
      created_at: '2026-05-28T00:00:00Z',
    });
    mockCreate.mockClear();
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await callDailyHapLlm(makeInput(REL_CHART), mockOpenai, mockSupabase, 'user-lucky');
    const sys = mockCreate.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === 'system',
    );
    expect(sys.content).toBe('# CANARY VARIANT v0.2\n새 본문');
  });

  it('loadPromptForUser throw → 그대로 전파 (callDailyHapLlm 가 catch 안 함)', async () => {
    (loadPromptForUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('PROMPT_NOT_FOUND: daily_hap'),
    );
    const { callDailyHapLlm } = await import('@/lib/today/openai');
    await expect(
      callDailyHapLlm(makeInput(null), mockOpenai, mockSupabase, TEST_USER_ID),
    ).rejects.toThrow('PROMPT_NOT_FOUND');
  });
});
