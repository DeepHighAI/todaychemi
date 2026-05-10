import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { callOpenAi } from '@/lib/llm/openai';
import type { LlmPayload } from '@/lib/llm/payload';
import type { BannedPhraseCategory } from '@/lib/llm/banned-phrases';
import type { SupabaseClient } from '@supabase/supabase-js';

// 최소 유효 LLM 출력 (150~200자 main_text, 각 배열 제약 충족)
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
    actions: ['행동1', '행동2', '행동3'],
    why_cards: [{ title: '제목1', reason: '이유1' }],
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

// 빈 banned-phrase 카탈로그 (테스트 중 파일 읽기 방지)
const EMPTY_CATALOG: BannedPhraseCategory[] = [];

// Supabase service-role mock (llm_cost_tracking 추적용)
// chain: .from(...) .select(...) .eq(...) .eq(...) .eq(...) .maybySingle()
function makeMockServiceClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const maybySingle = vi.fn().mockResolvedValue({ data: null, error: null });

  const eqLevel3 = { maybeSingle: maybySingle };
  const eqLevel2 = { eq: vi.fn().mockReturnValue(eqLevel3) };
  const eqLevel1 = { eq: vi.fn().mockReturnValue(eqLevel2) };
  const selectResult = { eq: vi.fn().mockReturnValue(eqLevel1) };
  const select = vi.fn().mockReturnValue(selectResult);
  const fromReturn = { select, upsert };
  const from = vi.fn().mockReturnValue(fromReturn);

  return {
    client: { from } as unknown as SupabaseClient,
    upsert,
    maybySingle,
  };
}

describe('callOpenAi — GPT-5o 클라이언트 래퍼', () => {
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

    expect(result.model).toBe('gpt-4o');
    expect(result.usage.token_in).toBe(120);
    expect(result.usage.token_out).toBe(250);
    expect(result.usage.total_usd).toBe(0); // D2
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
      actions: ['행동1', '행동2', '행동3'],
      why_cards: [{ title: '제목1', reason: '이유1' }],
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
      actions: ['행동1', '행동2', '행동3'],
      why_cards: [{ title: '제목1', reason: '이유1' }],
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

  it('usage — token_in/token_out 그대로 전달, total_usd=0 (D2)', async () => {
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
    expect(result.usage.total_usd).toBe(0);
  });

  it('llm_cost_tracking UPSERT 1회 호출, total_usd=0 (D2)', async () => {
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
    expect(call.model).toBe('gpt-4o');
    expect(call.total_usd).toBe(0);
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
    expect(callArgs.model).toBe('gpt-4o');
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
        model: 'gpt-4o',
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

    expect(result.model).toBe('gpt-4o');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
