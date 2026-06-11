import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock는 최상단에 호이스팅됨 — buildReplay 오케스트레이터 테스트용
vi.mock('@/lib/llm/prompt-loader', () => ({
  loadPromptForUser: vi.fn(),
  MODE_TO_PROMPT_NAME: {
    '일합': 'ilhap',
    '친구합': 'chinguhap',
    '돈합': 'donhap',
    '첫합': 'cheothap',
    '썸합': 'sseomhap',
    '오래합': 'oraehap',
  },
}));
vi.mock('@/lib/llm/openai', () => ({
  callOpenAi: vi.fn(),
}));

import {
  buildReplaySystemPrompt,
  buildReplayPayload,
  buildReplayCacheKey,
  buildReplay,
} from '@/lib/replay/builder';
import type { LlmPayload } from '@/lib/llm/payload';
import { loadPromptForUser } from '@/lib/llm/prompt-loader';
import { callOpenAi } from '@/lib/llm/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HapcardResult } from '@/types/hapcard';
import { MOCK_YUNSE_CORE } from '../../fixtures/hapcard';

const BASE_PROMPT = '# System Prompt — 일합 (일·직장 궁합)\n본문 내용';
const JINJIN_DATE = '2026-05-06';

// BASE_PAYLOAD는 buildReplayPayload/buildReplayCacheKey 단위테스트용 — LlmYunse 형식(list 없음)
const BASE_PAYLOAD: LlmPayload = {
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

describe('buildReplaySystemPrompt', () => {
  it('첫 줄에 재해석 모드 태그를 prepend한다', () => {
    const result = buildReplaySystemPrompt(BASE_PROMPT, JINJIN_DATE);
    const firstLine = result.split('\n')[0];
    expect(firstLine).toBe('[재해석 모드 — 일진:2026-05-06]');
  });

  it('원본 systemPrompt 내용을 보존한다', () => {
    const result = buildReplaySystemPrompt(BASE_PROMPT, JINJIN_DATE);
    expect(result).toContain(BASE_PROMPT);
  });

  it('잘못된 jinjin_date 형식 시 에러를 던진다', () => {
    expect(() => buildReplaySystemPrompt(BASE_PROMPT, '05-06-2026')).toThrow('INVALID_JINJIN_DATE');
    expect(() => buildReplaySystemPrompt(BASE_PROMPT, '2026/05/06')).toThrow('INVALID_JINJIN_DATE');
    expect(() => buildReplaySystemPrompt(BASE_PROMPT, '')).toThrow('INVALID_JINJIN_DATE');
  });
});

describe('buildReplayPayload', () => {
  it('time_context 필드가 추가된 페이로드를 반환한다', () => {
    const result = buildReplayPayload(BASE_PAYLOAD, JINJIN_DATE);
    expect(result.time_context).toEqual({ jinjin_date: JINJIN_DATE });
  });

  it('원본 페이로드 필드를 모두 보존한다', () => {
    const result = buildReplayPayload(BASE_PAYLOAD, JINJIN_DATE);
    expect(result.self_chart_core).toEqual(BASE_PAYLOAD.self_chart_core);
    expect(result.relation_chart_core).toEqual(BASE_PAYLOAD.relation_chart_core);
    expect(result.mode).toBe('일합');
    expect(result.theory_profile).toEqual(BASE_PAYLOAD.theory_profile);
  });

  it('원본 페이로드 객체를 변이하지 않는다', () => {
    buildReplayPayload(BASE_PAYLOAD, JINJIN_DATE);
    expect((BASE_PAYLOAD as unknown as Record<string, unknown>).time_context).toBeUndefined();
  });
});

describe('buildReplayCacheKey', () => {
  it('동일 입력은 항상 같은 해시를 반환한다 (결정형)', () => {
    const a = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: JINJIN_DATE,
    });
    const b = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: JINJIN_DATE,
    });
    expect(a).toBe(b);
  });

  it('jinjin_date 가 다르면 해시가 달라진다', () => {
    const a = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: '2026-05-06',
    });
    const b = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: '2026-05-07',
    });
    expect(a).not.toBe(b);
  });

  it('64자 hex 문자열을 반환한다 (sha256)', () => {
    const key = buildReplayCacheKey({
      user_chart_hash: 'abc',
      relation_chart_hash: 'def',
      prompt_version: 'v1',
      theory_profile_version: 'v1.0',
      jinjin_date: JINJIN_DATE,
    });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

// Phase B T3 — buildReplay classic_citation Korean 변환 (RAG 없음, convertHanja 항상 적용)
describe('buildReplay — classic_citation Korean 변환', () => {
  const MOCK_OHAENG_INTERPRETATION = {
    title: '병인 ↔ 병인 오행 해석',
    summary: '두 사람의 중심 기질이 모두 화라 표현과 추진을 보는 기준이 비슷합니다.',
    points: [
      { label: '중심 기질', body: '두 사람 모두 표현을 중심으로 움직입니다.' },
      { label: '균형 포인트', body: '서로 부족한 부분을 나누어 채울 수 있습니다.' },
      { label: '관계 흐름', body: '역할을 나누면 관계 흐름이 안정됩니다.' },
    ],
    tip: '역할과 결정 기준을 먼저 문서로 맞춰보세요.',
  };

  const MOCK_HAPCARD: HapcardResult = {
    hapcard_id: 'hapcard-001',
    user_id: 'user-001',
    relation_id: 'rel-001',
    mode: '일합',
    target_date: '2026-05-20',
    compat_score: 72,
    score_breakdown: { hap_chung_hyung_hae: 70, sipsin: 75, ohaeng: 68, yunse_adjustment: 0, mode_adjustment: 5 },
    content: {
      main_text: '갑목일간',
      cause_factors: [],
      classic_citation: [],
      actions: [],
      why_cards: [],
    },
    prompt_version: 'v0.3',
    llm_model: 'gpt-5',
    cache_key: 'cache-abc',
    user_chart_hash: 'self-hash',
    relation_chart_hash: 'rel-hash',
    archived_at: null,
    version_label: null,
    created_at: '2026-05-01T00:00:00Z',
  };

  const MOCK_PROMPT = {
    prompt_name: 'ilhap',
    version: 'v0.3',
    content: '시스템 프롬프트',
    status: 'active' as const,
    canary_ratio: null,
    notes: null,
    created_at: '2026-05-01T00:00:00Z',
  };

  // Supabase mock: user_charts + relation_charts + hapcard_replays
  function makeMockClients() {
    // DB에서 반환되는 chart_core는 ChartCore (yunse.list 필요) — MOCK_YUNSE_CORE 사용
    const chartRow = {
      chart_core: {
        year_pillar: '갑자',
        month_pillar: '을축',
        day_pillar: '병인',
        hour_pillar: null,
        day_master_element: '화',
        five_elements_counts: { 목: 2, 화: 1, 토: 1, 금: 0, 수: 0 },
        gender_normalized: 'M',
        yunse: MOCK_YUNSE_CORE,
      },
    };
    const replayRow = { replay_id: 'replay-001', created_at: '2026-05-06T00:00:00Z' };

    // fetchLatestUserChartForVersion / fetchLatestRelationChartForVersion 체인:
    // .select().eq().eq().order().limit().maybeSingle()
    const maybeSingle = vi.fn().mockResolvedValue({ data: chartRow, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eq2 = vi.fn().mockReturnValue({ order: orderFn });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectChart = vi.fn().mockReturnValue({ eq: eq1 });

    // INSERT hapcard_replays → select → single
    const single = vi.fn().mockResolvedValue({ data: replayRow, error: null });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });

    const from = vi.fn().mockImplementation((table: string) => {
      if (table === 'hapcard_replays') return { insert };
      return { select: selectChart };
    });

    const userClient = { from } as unknown as SupabaseClient;
    const serviceClient = { from } as unknown as SupabaseClient;
    return { userClient, serviceClient, insert };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (loadPromptForUser as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PROMPT);
  });

  it('classic_citation source_title/chapter → Korean 변환, original → convertHanja 적용', async () => {
    // replay builder에는 RAG hit 없음 → convertHanja(original_text)만 적용
    (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        main_text: '갑목일간',
        cause_factors: [],
        classic_citation: [
          {
            asset_id: 'classic_dts_001',
            // 한글(漢字) 패턴 → stripHanjaInParens 제거 대상
            source_title: '적천수(滴天髓)',
            // CHAPTER_READINGS '通神頌' → '통신송'
            source_chapter: '通神頌',
            // 甲子 → convertHanja → '갑자'
            original_text: '甲子',
            modern_translation: '갑자년을 논하다',
          },
        ],
        actions: [],
        why_cards: [],
        ohaeng_interpretation: MOCK_OHAENG_INTERPRETATION,
      },
      usage: { token_in: 100, token_out: 200, total_usd: 0 },
      model: 'gpt-5',
    });

    const { userClient, serviceClient, insert } = makeMockClients();

    await buildReplay(
      { hapcard: MOCK_HAPCARD, jinjin_date: JINJIN_DATE },
      { supabaseUserClient: userClient, supabaseServiceClient: serviceClient, openaiClient: { chat: { completions: { create: vi.fn() } } } },
    );

    const insertCall = insert.mock.calls[0][0];
    const callArgs = (callOpenAi as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const citations = insertCall.content.classic_citation as Array<{ source: string; original: string; modern: string }>;
    expect(callArgs.model).toBe('gpt-5');
    expect(citations).toHaveLength(1);
    // source_title '적천수(滴天髓)' → '적천수', source_chapter '通神頌' → '통신송'
    expect(citations[0].source).toBe('적천수 통신송');
    // convertHanja('甲子') → '갑자'
    expect(citations[0].original).toBe('갑자');
    // modern_translation 그대로
    expect(citations[0].modern).toBe('갑자년을 논하다');
    expect(insertCall.content.ohaeng_interpretation).toEqual(MOCK_OHAENG_INTERPRETATION);
  });

  it('MeEdit 후 user_charts 복수 row → latest row 반환으로 buildReplay 성공 (USER_CHART_LOOKUP_FAILED 회귀)', async () => {
    // MeEdit 로 신규 user_chart row 가 INSERT (ADR-016 FK 보존) → 복수 row 시나리오.
    // fetchLatestUserChartForVersion 이 .order(desc).limit(1) 로 안전하게 latest 선택.
    (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: { main_text: '갑목일간', cause_factors: [], classic_citation: [], actions: [], why_cards: [] },
      usage: { token_in: 10, token_out: 20, total_usd: 0 },
      model: 'gpt-5',
    });

    const { userClient, serviceClient } = makeMockClients();

    await expect(
      buildReplay(
        { hapcard: MOCK_HAPCARD, jinjin_date: JINJIN_DATE },
        { supabaseUserClient: userClient, supabaseServiceClient: serviceClient, openaiClient: { chat: { completions: { create: vi.fn() } } } },
      ),
    ).resolves.toBeDefined();
  });

  it('payload 에 cross_analysis 포함 + age_gap 부재 (birth 미페치)', async () => {
    (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        main_text: '갑목일간',
        cause_factors: [],
        classic_citation: [],
        actions: [],
        why_cards: [],
      },
      usage: { token_in: 50, token_out: 100, total_usd: 0 },
      model: 'gpt-5',
    });

    const { userClient, serviceClient } = makeMockClients();

    await buildReplay(
      { hapcard: MOCK_HAPCARD, jinjin_date: JINJIN_DATE },
      { supabaseUserClient: userClient, supabaseServiceClient: serviceClient, openaiClient: { chat: { completions: { create: vi.fn() } } } },
    );

    const callArgs = (callOpenAi as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cross = callArgs.userPayload.cross_analysis;
    expect(cross).toBeDefined();
    expect(cross.version).toBe('cross-v1');
    // replay 는 출생연도 미제공 — age_gap 키 자체 부재
    expect(cross.age_gap).toBeUndefined();
    // 동일 6모드 프롬프트 호환 — sipsin_cross/gungwi_events/yunse_cross/ilgan_pair 동봉
    expect(cross.sipsin_cross).toBeDefined();
    expect(cross.ilgan_pair).toBeDefined();
    // 리뷰 F1: 저장 yunse 는 row 생성 시점 고정 — "올해/이번 달/오늘 일진" 단정을 막기 위해
    // 시간층(shared: 세운/월운/일운) facts 제외, 대운(daeun)만 허용
    const layers = (cross.yunse_cross as Array<{ layer: string }>).map((f) => f.layer);
    expect(layers.every((layer) => layer === 'daeun')).toBe(true);
  });

  it('classic_citation 빈 배열이면 변환 없이 빈 배열 그대로', async () => {
    (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        main_text: '갑목일간',
        cause_factors: [],
        classic_citation: [],
        actions: [],
        why_cards: [],
      },
      usage: { token_in: 50, token_out: 100, total_usd: 0 },
      model: 'gpt-5',
    });

    const { userClient, serviceClient, insert } = makeMockClients();

    await buildReplay(
      { hapcard: MOCK_HAPCARD, jinjin_date: JINJIN_DATE },
      { supabaseUserClient: userClient, supabaseServiceClient: serviceClient, openaiClient: { chat: { completions: { create: vi.fn() } } } },
    );

    const insertCall = insert.mock.calls[0][0];
    expect(insertCall.content.classic_citation).toEqual([]);
  });

  // pay-per-use 모델 C: 동시 더블탭/재요청 시 (hapcard_id, jinjin_date) unique 충돌(23505) →
  // whatif/builder 와 동일하게 기존 row 를 재조회해 반환(throw 금지). 멱등성 패리티.
  describe('idempotency 23505 recovery', () => {
    const EXISTING_ROW = {
      replay_id: 'existing-replay-999',
      hapcard_id: MOCK_HAPCARD.hapcard_id,
      user_id: MOCK_HAPCARD.user_id,
      jinjin_date: JINJIN_DATE,
      replay_reason: null,
      content: { main_text: '기존 재해석', cause_factors: [], classic_citation: [], actions: [], why_cards: [] },
      prompt_version: 'v0.3',
      llm_model: 'gpt-5',
      cache_key: 'existing-cache-key',
      created_at: '2026-05-06T02:00:00Z',
    };

    function makeConflictClients(existingRow: unknown) {
      const chartRow = {
        chart_core: {
          year_pillar: '갑자', month_pillar: '을축', day_pillar: '병인', hour_pillar: null,
          day_master_element: '화', five_elements_counts: { 목: 2, 화: 1, 토: 1, 금: 0, 수: 0 },
          gender_normalized: 'M', yunse: MOCK_YUNSE_CORE,
        },
      };
      const maybeSingle = vi.fn().mockResolvedValue({ data: chartRow, error: null });
      const limitFn = vi.fn().mockReturnValue({ maybeSingle });
      const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
      const eq2 = vi.fn().mockReturnValue({ order: orderFn });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const selectChart = vi.fn().mockReturnValue({ eq: eq1 });

      // INSERT → 23505 conflict
      const single = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });
      const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });

      // retry: select('*').eq('hapcard_id').eq('jinjin_date').maybeSingle()
      const retryMaybeSingle = vi.fn().mockResolvedValue({ data: existingRow, error: null });
      const retryEq2 = vi.fn().mockReturnValue({ maybeSingle: retryMaybeSingle });
      const retryEq1 = vi.fn().mockReturnValue({ eq: retryEq2 });
      const selectReplay = vi.fn().mockReturnValue({ eq: retryEq1 });

      const from = vi.fn().mockImplementation((table: string) => {
        if (table === 'hapcard_replays') return { insert, select: selectReplay };
        return { select: selectChart };
      });
      const client = { from } as unknown as SupabaseClient;
      return { userClient: client, serviceClient: client, insert, retryMaybeSingle };
    }

    it('insert 23505 → 기존 row 재조회해서 반환 (throw 안 함)', async () => {
      (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue({
        output: { main_text: '신규 재해석', cause_factors: [], classic_citation: [], actions: [], why_cards: [], ohaeng_interpretation: { title: 't', summary: 's', points: [], tip: 'x' } },
        usage: { token_in: 10, token_out: 20, total_usd: 0 },
        model: 'gpt-5',
      });
      const { userClient, serviceClient, retryMaybeSingle } = makeConflictClients(EXISTING_ROW);

      const result = await buildReplay(
        { hapcard: MOCK_HAPCARD, jinjin_date: JINJIN_DATE },
        { supabaseUserClient: userClient, supabaseServiceClient: serviceClient, openaiClient: { chat: { completions: { create: vi.fn() } } } },
      );

      // 기존 persisted row 가 진실의 원천 — 재조회된 row 의 값 반환
      expect(result.replay_id).toBe('existing-replay-999');
      expect(result.cache_key).toBe('existing-cache-key');
      expect(result.created_at).toBe('2026-05-06T02:00:00Z');
      expect(result.content.main_text).toBe('기존 재해석');
      // base 필드는 input hapcard 에서
      expect(result.hapcard_id).toBe(MOCK_HAPCARD.hapcard_id);
      expect(result.jinjin_date).toBe(JINJIN_DATE);
      expect(retryMaybeSingle).toHaveBeenCalledTimes(1);
    });

    it('23505 인데 재조회도 miss → race recovery missed throw', async () => {
      (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue({
        output: { main_text: 'x', cause_factors: [], classic_citation: [], actions: [], why_cards: [], ohaeng_interpretation: { title: 't', summary: 's', points: [], tip: 'x' } },
        usage: { token_in: 10, token_out: 20, total_usd: 0 },
        model: 'gpt-5',
      });
      const { userClient, serviceClient } = makeConflictClients(null);

      await expect(
        buildReplay(
          { hapcard: MOCK_HAPCARD, jinjin_date: JINJIN_DATE },
          { supabaseUserClient: userClient, supabaseServiceClient: serviceClient, openaiClient: { chat: { completions: { create: vi.fn() } } } },
        ),
      ).rejects.toThrow('HAPCARD_REPLAY_INSERT_FAILED');
    });
  });
});
