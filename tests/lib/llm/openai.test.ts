import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { callOpenAi } from '@/lib/llm/openai';
import { resetLlmCircuitBreakersForTest } from '@/lib/llm/circuit-breaker';
import { computeCrossAnalysis } from '@/lib/saju/cross';
import type { LlmPayload } from '@/lib/llm/payload';
import type { BannedPhraseCategory } from '@/lib/llm/banned-phrases';
import type { ChartCore } from '@/types/chart';
import type { SupabaseClient } from '@supabase/supabase-js';

// 최소 유효 LLM 출력 (150~200자 main_text, 각 배열 제약 충족)
function makeValidOhaengInterpretation() {
  return {
    title: '갑인 ↔ 병오 오행 해석',
    summary: '본인의 목 기운이 인연의 화 기운을 살려 주는 흐름입니다.',
    points: [
      { label: '중심 기질', body: '본인은 성장, 인연은 표현을 중심으로 움직입니다.' },
      { label: '균형 포인트', body: '서로 부족한 부분을 나누어 채울 수 있습니다.' },
      { label: '관계 흐름', body: '역할을 나누면 관계 흐름이 안정됩니다.' },
    ],
    tip: '대화 전에 기대치를 한 줄로 맞춰보세요.',
  };
}

function makeValidOutputJson() {
  const mainText = '갑목일간'.repeat(40).slice(0, 160); // 160자
  return JSON.stringify({
    main_text: mainText,
    cause_factors: [
      { name: '원인1', effect: '결과1' },
      { name: '원인2', effect: '결과2' },
      { name: '원인3', effect: '결과3' },
    ],
    classic_citation: [],
    actions: ['대표 행동', '행동1', '행동2', '행동3'],
    why_cards: [{ title: '제목1', reason: '이유1' }],
    ohaeng_interpretation: makeValidOhaengInterpretation(),
  });
}

// OpenAI chat completion 응답 mock
function makeOpenAiResponse(content: string, tokenIn = 100, tokenOut = 200) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: tokenIn, completion_tokens: tokenOut, total_tokens: tokenIn + tokenOut },
  };
}

// 유효한 LlmPayload
function makeValidPayload(): LlmPayload {
  return {
    self_chart_core: {
      year_pillar: '갑자',
      month_pillar: '을축',
      day_pillar: '병인',
      hour_pillar: null,
      day_master_element: '화',
      five_elements_counts: { 목: 2, 화: 1, 토: 1, 금: 0, 수: 0 },
      gender_normalized: 'M',
      yunse: { daeun: { start_age: 7, current_index: 0, current: { age: 7, pillar: '갑자', year: 1990 } }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
    },
    relation_chart_core: {
      year_pillar: '기묘',
      month_pillar: '경진',
      day_pillar: '신사',
      hour_pillar: null,
      day_master_element: '금',
      five_elements_counts: { 목: 0, 화: 0, 토: 2, 금: 2, 수: 0 },
      gender_normalized: 'F',
      yunse: { daeun: { start_age: 7, current_index: 0, current: { age: 7, pillar: '갑자', year: 1990 } }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
    },
    mode: '일합',
    theory_profile: { profile_version: 'v1.0' },
  };
}

// computeCrossAnalysis 입력용 ChartCore 픽스처 (full yunse list 필요)
const CROSS_YUNSE: ChartCore['yunse'] = {
  daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 },
  seyun: { current_pillar: '병오', current_year: 2026 },
  wolun: { current_pillar: '계사', current_month: '2026-05' },
  iliun: { today_pillar: '갑자', today_date: '2026-05-07' },
};

const CROSS_SELF: ChartCore = {
  year_pillar: '甲寅',
  month_pillar: '乙卯',
  day_pillar: '丙午',
  hour_pillar: '丁亥',
  day_master_element: '화',
  five_elements_counts: { 목: 3, 화: 3, 토: 1, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: CROSS_YUNSE,
};

const CROSS_RELATION: ChartCore = {
  year_pillar: '戊申',
  month_pillar: '己酉',
  day_pillar: '庚戌',
  hour_pillar: '辛丑',
  day_master_element: '금',
  five_elements_counts: { 목: 0, 화: 0, 토: 3, 금: 4, 수: 1 },
  gender_normalized: 'F',
  yunse: CROSS_YUNSE,
};

// 빈 banned-phrase 카탈로그 (테스트 중 파일 읽기 방지)
const EMPTY_CATALOG: BannedPhraseCategory[] = [];
const ORIGINAL_ENV = { ...process.env };

// Supabase service-role mock (llm_cost_tracking 추적용)
// chain: .from(...) .select(...) .eq(...) .eq(...) .eq(...) .maybySingle()
function makeMockServiceClient(opts?: { budgetRows?: Array<{ total_usd: number }>; upsertError?: Error }) {
  const upsert = vi.fn().mockResolvedValue({ error: opts?.upsertError ?? null });
  const maybySingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const budgetEq = vi.fn().mockResolvedValue({ data: opts?.budgetRows ?? [], error: null });

  const eqLevel3 = { maybeSingle: maybySingle };
  const eqLevel2 = { eq: vi.fn().mockReturnValue(eqLevel3) };
  const eqLevel1 = { eq: vi.fn().mockReturnValue(eqLevel2) };
  const selectResult = { eq: vi.fn().mockReturnValue(eqLevel1) };
  const select = vi.fn((columns: string) => {
    if (columns === 'total_usd') return { eq: budgetEq };
    return selectResult;
  });
  const fromReturn = { select, upsert };
  const from = vi.fn().mockReturnValue(fromReturn);

  return {
    client: { from } as unknown as SupabaseClient,
    upsert,
    maybySingle,
    budgetEq,
  };
}

describe('callOpenAi — GPT-5 클라이언트 래퍼', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.LLM_DAILY_BUDGET_USD;
    resetLlmCircuitBreakersForTest();
  });

  it('PII 가드 — userPayload에 허용 외 키(birth_date) 포함 → PII_GUARD_VIOLATION throw, OpenAI 호출 0회', async () => {
    const createMock = vi.fn();
    const { client: supabase } = makeMockServiceClient();
    const illegalPayload = {
      ...makeValidPayload(),
      birth_date: '1990-01-01', // PII 위반
    } as unknown as LlmPayload;

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: illegalPayload },
        {
          openaiClient: { chat: { completions: { create: createMock } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow('PII_GUARD_VIOLATION');

    expect(createMock).not.toHaveBeenCalled();
  });

  it('PII 가드 — 허용 top-level 내부 nested birth_date 포함 → PII_GUARD_VIOLATION throw, OpenAI 호출 0회', async () => {
    const createMock = vi.fn();
    const { client: supabase } = makeMockServiceClient();
    const validPayload = makeValidPayload();
    const nestedIllegalPayload = {
      ...validPayload,
      self_chart_core: {
        ...validPayload.self_chart_core,
        birth_date: '1990-01-01',
      },
    };

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: nestedIllegalPayload },
        {
          openaiClient: { chat: { completions: { create: createMock } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow('PII_GUARD_VIOLATION');

    expect(createMock).not.toHaveBeenCalled();
  });

  it('PII 가드 — nested prefixed/camelCase PII 키 포함 → PII_GUARD_VIOLATION throw, OpenAI 호출 0회', async () => {
    const createMock = vi.fn();
    const { client: supabase } = makeMockServiceClient();
    const validPayload = makeValidPayload();
    const nestedIllegalPayload = {
      ...validPayload,
      self_chart_core: {
        ...validPayload.self_chart_core,
        relation_nickname: '민감한별명',
        userEmail: 'secret@example.com',
        displayName: '실명',
        rawGender: 'F',
      },
    };

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: nestedIllegalPayload },
        {
          openaiClient: { chat: { completions: { create: createMock } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow('PII_GUARD_VIOLATION');

    expect(createMock).not.toHaveBeenCalled();
  });

  it('whitelist — cross_analysis top-level 키 허용, PII 가드 통과 후 정상 호출', async () => {
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(makeValidOutputJson()));
    const { client: supabase } = makeMockServiceClient();
    const cross = computeCrossAnalysis({
      self: CROSS_SELF,
      relation: CROSS_RELATION,
      mode: '일합',
      self_birth_year: 1990,
      relation_birth_year: 1993,
    });
    const payload: LlmPayload = { ...makeValidPayload(), cross_analysis: cross };

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: payload },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(result.output).toBeDefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('PII 가드 — cross_analysis 내부 주입 palace_name 류 키 → PII_GUARD_VIOLATION, 호출 0회', async () => {
    const create = vi.fn();
    const { client: supabase } = makeMockServiceClient();
    const cross = computeCrossAnalysis({ self: CROSS_SELF, relation: CROSS_RELATION });
    // 재귀 스캔 함정 검증 — /(^|_)name($|_)/ 적중 키를 nested 배열 안에 주입
    const tampered = {
      ...cross,
      gungwi_events: [
        ...cross.gungwi_events,
        { kind: 'chung', palace: '일주', palace_name: '배우자궁', detail: '주입' },
      ],
    };
    const payload = {
      ...makeValidPayload(),
      cross_analysis: tampered,
    } as unknown as LlmPayload;

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: payload },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow('PII_GUARD_VIOLATION');

    expect(create).not.toHaveBeenCalled();
  });

  it('정상 응답 → HapcardLlmOutput parse 성공, result 반환', async () => {
    const validJson = makeValidOutputJson();
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(validJson, 120, 250));
    const { client: supabase } = makeMockServiceClient();

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(result.model).toBe('gpt-5-mini');
    expect(result.usage.token_in).toBe(120);
    expect(result.usage.token_out).toBe(250);
    expect(result.usage.total_usd).toBe(0.00053);
    expect(result.output.main_text).toHaveLength(160);
    expect(result.output.cause_factors).toHaveLength(3);
  });

  it('JSON parse 실패 → 1회 재시도 → 2차 성공', async () => {
    const validJson = makeValidOutputJson();
    const create = vi
      .fn()
      .mockResolvedValueOnce(makeOpenAiResponse('not valid json'))
      .mockResolvedValueOnce(makeOpenAiResponse(validJson));
    const { client: supabase } = makeMockServiceClient();

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.output).toBeDefined();
  });

  it('JSON parse 2회 실패 → throw', async () => {
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse('not valid json'));
    const { client: supabase } = makeMockServiceClient();

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: makeValidPayload() },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow();

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('Zod strict 위반(unknown 키 score) → 즉시 throw, 재시도 없음', async () => {
    const mainText = '갑목일간'.repeat(40).slice(0, 160);
    const zodViolation = JSON.stringify({
      main_text: mainText,
      cause_factors: [
        { name: '원인1', effect: '결과1' },
        { name: '원인2', effect: '결과2' },
        { name: '원인3', effect: '결과3' },
      ],
      classic_citation: [],
      actions: ['대표 행동', '행동1', '행동2', '행동3'],
      why_cards: [{ title: '제목1', reason: '이유1' }],
      ohaeng_interpretation: makeValidOhaengInterpretation(),
      score: 95, // unknown 키 — strict() 위반
    });
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(zodViolation));
    const { client: supabase } = makeMockServiceClient();

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: makeValidPayload() },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow();

    // Zod 오류는 재시도 불가 — 1회만 호출
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('banned-phrase 발견 → 1회 재시도 → 2차 정상', async () => {
    const validJson = makeValidOutputJson();
    const bannedCatalog: BannedPhraseCategory[] = [
      { category: 'test', description: '테스트', phrases: ['금지어'] },
    ];
    const bannedJson = makeValidOutputJson().replace('행동1', '금지어 포함 행동');
    const create = vi
      .fn()
      .mockResolvedValueOnce(makeOpenAiResponse(bannedJson))
      .mockResolvedValueOnce(makeOpenAiResponse(validJson));
    const { client: supabase } = makeMockServiceClient();

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: bannedCatalog,
      },
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.output).toBeDefined();
  });

  it('banned-phrase 2회 연속 → BANNED_PHRASE_DETECTED throw', async () => {
    const bannedCatalog: BannedPhraseCategory[] = [
      { category: 'test', description: '테스트', phrases: ['금지어'] },
    ];
    const bannedJson = makeValidOutputJson().replace('행동1', '금지어 포함 행동');
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(bannedJson));
    const { client: supabase } = makeMockServiceClient();

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: makeValidPayload() },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: bannedCatalog,
        },
      ),
    ).rejects.toThrow('BANNED_PHRASE_DETECTED');

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('점수 누설(\\d점 패턴) → banned-phrase와 동일 처리 (재시도 → 실패 시 throw)', async () => {
    const mainText = '갑목일간'.repeat(40).slice(0, 160);
    const scoreLeak = JSON.stringify({
      main_text: mainText + ' 95점 수준입니다',
      cause_factors: [
        { name: '원인1', effect: '결과1' },
        { name: '원인2', effect: '결과2' },
        { name: '원인3', effect: '결과3' },
      ],
      classic_citation: [],
      actions: ['대표 행동', '행동1', '행동2', '행동3'],
      why_cards: [{ title: '제목1', reason: '이유1' }],
      ohaeng_interpretation: makeValidOhaengInterpretation(),
    });
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(scoreLeak));
    const { client: supabase } = makeMockServiceClient();

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: makeValidPayload() },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow('BANNED_PHRASE_DETECTED');
  });

  it('usage — token_in/token_out 그대로 전달, total_usd 추정값 반환', async () => {
    const validJson = makeValidOutputJson();
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(validJson, 500, 800));
    const { client: supabase } = makeMockServiceClient();

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(result.usage.token_in).toBe(500);
    expect(result.usage.token_out).toBe(800);
    expect(result.usage.total_usd).toBe(0.001725);
  });

  it('llm_cost_tracking UPSERT 1회 호출, total_usd 추정값 누적', async () => {
    const validJson = makeValidOutputJson();
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(validJson, 100, 200));
    const { client: supabase, upsert } = makeMockServiceClient();

    await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.provider).toBe('openai');
    expect(call.model).toBe('gpt-5-mini');
    expect(call.total_usd).toBe(0.000425);
  });

  it('llm_cost_tracking UPSERT 실패 → budget 증적 누락 방지를 위해 throw', async () => {
    const validJson = makeValidOutputJson();
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(validJson, 100, 200));
    const { client: supabase, upsert } = makeMockServiceClient({
      upsertError: new Error('write failed'),
    });

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: makeValidPayload() },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow('LLM_COST_TRACKING_FAILED: write failed');

    expect(create).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('response_format json_object + store:false 옵션 전달 검증', async () => {
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(makeValidOutputJson()));
    const { client: supabase } = makeMockServiceClient();

    await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    const callArgs = create.mock.calls[0][0];
    expect(callArgs.response_format).toEqual({ type: 'json_object' });
    expect(callArgs.store).toBe(false);
    expect(callArgs.model).toBe('gpt-5-mini');
  });

  it('reasoning_effort=low + max_completion_tokens=4000 전달 검증', async () => {
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(makeValidOutputJson()));
    const { client: supabase } = makeMockServiceClient();

    await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    const callArgs = create.mock.calls[0][0];
    expect(callArgs.reasoning_effort).toBe('low');
    expect(callArgs.max_completion_tokens).toBe(4000);
  });

  it('5xx 에러 응답 → 재시도', async () => {
    const validJson = makeValidOutputJson();
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('500 Internal Server Error'))
      .mockResolvedValueOnce(makeOpenAiResponse(validJson));
    const { client: supabase } = makeMockServiceClient();

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.output).toBeDefined();
  });

  it('OpenAI 5xx 2회 실패 → Claude fallback 성공, anthropic 비용 추적', async () => {
    const validJson = makeValidOutputJson();
    const create = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));
    const anthropicCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: validJson }],
      usage: { input_tokens: 90, output_tokens: 140 },
    });
    const { client: supabase, upsert } = makeMockServiceClient();

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        anthropicClient: { messages: { create: anthropicCreate } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(anthropicCreate).toHaveBeenCalledTimes(1);
    expect(result.model).toBe('claude-fallback');
    expect(result.usage.token_in).toBe(90);
    expect(result.usage.token_out).toBe(140);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      provider: 'anthropic',
      model: 'claude-fallback',
    });
  });

  it('LLM_DAILY_BUDGET_USD 초과 → OpenAI 호출 전 USER_QUOTA_EXCEEDED', async () => {
    process.env.LLM_DAILY_BUDGET_USD = '1';
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(makeValidOutputJson()));
    const { client: supabase } = makeMockServiceClient({ budgetRows: [{ total_usd: 1.2 }] });

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: makeValidPayload() },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
          now: () => new Date('2026-05-31T00:00:00Z'),
        },
      ),
    ).rejects.toThrow('USER_QUOTA_EXCEEDED');

    expect(create).not.toHaveBeenCalled();
  });

  it('Vercel production에서 LLM_DAILY_BUDGET_USD 누락 → OpenAI 호출 전 USER_QUOTA_EXCEEDED', async () => {
    process.env.VERCEL_ENV = 'production';
    delete process.env.LLM_DAILY_BUDGET_USD;
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(makeValidOutputJson()));
    const { client: supabase } = makeMockServiceClient();

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: makeValidPayload() },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow('LLM_DAILY_BUDGET_USD is required in production');

    expect(create).not.toHaveBeenCalled();
  });

  it('로컬 next start 환경에서는 LLM_DAILY_BUDGET_USD 없이도 OpenAI 호출 진행', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.VERCEL_ENV;
    delete process.env.LLM_DAILY_BUDGET_USD;
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(makeValidOutputJson()));
    const { client: supabase, budgetEq } = makeMockServiceClient();

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(budgetEq).not.toHaveBeenCalled();
    expect(result.output).toBeDefined();
  });

  it('401 auth 에러 → 즉시 throw, 재시도 없음', async () => {
    const create = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));
    const { client: supabase } = makeMockServiceClient();

    await expect(
      callOpenAi(
        { systemPrompt: '시스템', userPayload: makeValidPayload() },
        {
          openaiClient: { chat: { completions: { create } } },
          supabaseServiceRole: supabase,
          bannedPhraseCatalog: EMPTY_CATALOG,
        },
      ),
    ).rejects.toThrow('401');

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('커스텀 schema/payloadWhitelist/model — whatif 전용 페이로드 파싱 성공', async () => {
    const WhatifSchema = z.object({ body: z.string() }).strict();
    const whatifWhitelist = new Set(['self_chart_core', 'type']);
    const validWhatifJson = JSON.stringify({ body: '갑목일간 진단 결과입니다.' });
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(validWhatifJson));
    const { client: supabase } = makeMockServiceClient();

    const result = await callOpenAi(
      {
        systemPrompt: 'whatif 시스템',
        userPayload: { self_chart_core: {}, type: 'work' },
        schema: WhatifSchema,
        payloadWhitelist: whatifWhitelist,
        model: 'gpt-5',
      },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect((result.output as { body: string }).body).toBe('갑목일간 진단 결과입니다.');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('time_context 포함 payload (replay용) → PII 가드 통과', async () => {
    const validJson = makeValidOutputJson();
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(validJson));
    const { client: supabase } = makeMockServiceClient();
    const replayPayload = { ...makeValidPayload(), time_context: { jinjin_date: '2026-05-06' } };

    const result = await callOpenAi(
      { systemPrompt: '[재해석 모드 — 일진:2026-05-06]\n시스템', userPayload: replayPayload },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(result.model).toBe('gpt-5-mini');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('한자 포함 LLM 응답 → throw 없이 통과, console.warn([CLASSICAL_HANJA]) 호출', async () => {
    // main_text에 한자(木) 포함 — 유효한 JSON 구조는 유지
    const mainText = '갑목일간'.repeat(40).slice(0, 155) + '木기운';
    const hanjaJson = JSON.stringify({
      main_text: mainText,
      cause_factors: [
        { name: '원인1', effect: '결과1' },
        { name: '원인2', effect: '결과2' },
        { name: '원인3', effect: '결과3' },
      ],
      classic_citation: [],
      actions: ['대표 행동', '행동1', '행동2', '행동3'],
      why_cards: [{ title: '제목1', reason: '이유1' }],
      ohaeng_interpretation: makeValidOhaengInterpretation(),
    });
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(hanjaJson));
    const { client: supabase } = makeMockServiceClient();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    // throw 없이 결과 반환 (Option C: warn-and-pass)
    expect(result).toBeDefined();
    // console.warn '[CLASSICAL_HANJA]' prefix 로 호출됨
    expect(warnSpy).toHaveBeenCalledWith(
      '[CLASSICAL_HANJA]',
      expect.objectContaining({ phrase: expect.any(String) }),
    );
    warnSpy.mockRestore();
  });

  it('한자 없는 정상 응답 → console.warn 미호출', async () => {
    const create = vi.fn().mockResolvedValue(makeOpenAiResponse(makeValidOutputJson()));
    const { client: supabase } = makeMockServiceClient();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await callOpenAi(
      { systemPrompt: '시스템', userPayload: makeValidPayload() },
      {
        openaiClient: { chat: { completions: { create } } },
        supabaseServiceRole: supabase,
        bannedPhraseCatalog: EMPTY_CATALOG,
      },
    );

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
