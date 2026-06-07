import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock은 최상단에 호이스팅됨
vi.mock('@/lib/scoring/index', () => ({
  computeScore: vi.fn(),
}));
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
vi.mock('@/lib/rag/embeddings', () => ({
  embedQuery: vi.fn(),
}));
vi.mock('@/lib/rag/classics', () => ({
  retrieveClassics: vi.fn(),
}));
vi.mock('@/lib/llm/openai', () => ({
  callOpenAi: vi.fn(),
}));
vi.mock('@/lib/rag/grounding-validator', () => ({
  validateClassicCitations: vi.fn(),
}));

import { buildHapcard, buildHapcardWithMeta } from '@/lib/hapcard/builder';
import { computeScore } from '@/lib/scoring/index';
import { loadPromptForUser } from '@/lib/llm/prompt-loader';
import { embedQuery } from '@/lib/rag/embeddings';
import { retrieveClassics } from '@/lib/rag/classics';
import { callOpenAi } from '@/lib/llm/openai';
import { validateClassicCitations } from '@/lib/rag/grounding-validator';
import { deriveCacheKey } from '@/lib/hapcard/cache-key';
import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HapcardResult } from '@/types/hapcard';
import type { BuildHapcardInput, BuildHapcardDeps } from '@/lib/hapcard/builder';
import { MOCK_YUNSE_CORE } from '../../fixtures/hapcard';

// --- 픽스처 ---

const SELF: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: MOCK_YUNSE_CORE,
};

const RELATION: ChartCore = {
  year_pillar: '기묘',
  month_pillar: '경진',
  day_pillar: '신사',
  hour_pillar: null,
  day_master_element: '금',
  five_elements_counts: { 목: 0, 화: 0, 토: 2, 금: 2, 수: 0 },
  gender_normalized: 'F',
  yunse: MOCK_YUNSE_CORE,
};

const BASE_INPUT: BuildHapcardInput = {
  user_id: 'user-123',
  relation_id: 'rel-456',
  mode: '일합' as Mode,
  self: SELF,
  self_chart_hash: 'self-hash-abc',
  relation: RELATION,
  relation_chart_hash: 'rel-hash-def',
  theory_profile_version: 'v1.0-late_zi',
  target_date: '2026-05-21',
};

const MOCK_PROMPT = {
  prompt_name: 'ilhap',
  version: 'v0.2',
  content: '시스템 프롬프트 내용',
  status: 'active' as const,
  canary_ratio: null,
  notes: null,
  created_at: '2026-05-04T00:00:00Z',
};

const MOCK_SCORE = {
  score: 72,
  components: { hap_chung_hyung_hae: 70, sipsin: 75, ohaeng: 68 },
  mode_adjustment: 5,
  yunse_adjustment: 3,
  scenario_estimate: null,
  scoring_version: 1,
};

const MOCK_EMBEDDING = Array.from({ length: 1536 }, () => 0.1);

const MOCK_OHAENG_INTERPRETATION = {
  title: '병인 ↔ 신사 오행 해석',
  summary: '본인의 화 기운이 인연의 금 기운을 다듬는 긴장 구조입니다.',
  points: [
    { label: '중심 기질', body: '본인은 표현, 인연은 기준을 중심으로 움직입니다.' },
    { label: '균형 포인트', body: '서로 부족한 부분을 나누어 채울 수 있습니다.' },
    { label: '관계 흐름', body: '역할을 나누면 관계 흐름이 안정됩니다.' },
  ],
  tip: '역할과 결정 기준을 먼저 문서로 맞춰보세요.',
};

const MOCK_LLM_OUTPUT = {
  main_text: '갑목일간'.repeat(40).slice(0, 160),
  cause_factors: [
    { name: '원인1', effect: '결과1' },
    { name: '원인2', effect: '결과2' },
    { name: '원인3', effect: '결과3' },
  ],
  classic_citation: [],
  actions: ['대표 행동', '행동1', '행동2', '행동3'],
  why_cards: [{ title: '제목1', reason: '이유1' }],
  ohaeng_interpretation: MOCK_OHAENG_INTERPRETATION,
};

const MOCK_LLM_RESULT = {
  output: MOCK_LLM_OUTPUT,
  usage: { token_in: 100, token_out: 200, total_usd: 0 },
  model: 'gpt-5' as const,
};

const EXPECTED_CACHE_KEY = deriveCacheKey({
  relation_id: BASE_INPUT.relation_id,
  user_chart_hash: BASE_INPUT.self_chart_hash,
  relation_chart_hash: BASE_INPUT.relation_chart_hash,
  mode: BASE_INPUT.mode,
  prompt_version: MOCK_PROMPT.version,
  model_id: 'gpt-5',
  theory_profile_version: BASE_INPUT.theory_profile_version,
  target_date: BASE_INPUT.target_date,
});

// DB 삽입 후 반환될 행
function makeInsertedRow(cacheKey: string): HapcardResult {
  return {
    hapcard_id: 'hapcard-uuid-001',
    user_id: BASE_INPUT.user_id,
    relation_id: BASE_INPUT.relation_id,
    mode: BASE_INPUT.mode,
    target_date: BASE_INPUT.target_date,
    compat_score: MOCK_SCORE.score,
    score_breakdown: {
      hap_chung_hyung_hae: MOCK_SCORE.components.hap_chung_hyung_hae,
      sipsin: MOCK_SCORE.components.sipsin,
      ohaeng: MOCK_SCORE.components.ohaeng,
      yunse_adjustment: MOCK_SCORE.yunse_adjustment,
      mode_adjustment: MOCK_SCORE.mode_adjustment,
    },
    content: {
      main_text: MOCK_LLM_OUTPUT.main_text,
      cause_factors: MOCK_LLM_OUTPUT.cause_factors,
      classic_citation: [],
      actions: MOCK_LLM_OUTPUT.actions,
      why_cards: MOCK_LLM_OUTPUT.why_cards,
      ohaeng_interpretation: MOCK_LLM_OUTPUT.ohaeng_interpretation,
    },
    prompt_version: MOCK_PROMPT.version,
    llm_model: 'gpt-5',
    cache_key: cacheKey,
    user_chart_hash: BASE_INPUT.self_chart_hash,
    relation_chart_hash: BASE_INPUT.relation_chart_hash,
    archived_at: null,
    version_label: null,
    created_at: '2026-05-04T22:00:00Z',
  };
}

// --- Supabase 서비스 클라이언트 mock 팩토리 (snapshot upsert 포함) ---
function makeMockServiceClientWithSnapshot() {
  const snapshotUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'hapcard_score_snapshots') return { upsert: snapshotUpsert };
    return {};
  });
  return {
    client: { from } as unknown as SupabaseClient,
    snapshotUpsert,
  };
}

// --- Supabase 유저 클라이언트 mock 팩토리 ---
function makeMockUserClient(opts: {
  cachedRow?: HapcardResult | null;
  insertedRow?: HapcardResult;
  relationNickname?: string;
}) {
  const cachedRow = opts.cachedRow ?? null;
  const insertedRow = opts.insertedRow ?? makeInsertedRow(EXPECTED_CACHE_KEY);

  // hapcards (cache + insert) 체인
  const maybeSingle = vi.fn().mockResolvedValue({ data: cachedRow, error: null });
  const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null });
  const selectAfterInsert = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });
  const eqForCache = vi.fn().mockReturnValue({ maybeSingle });
  const selectForCache = vi.fn().mockReturnValue({ eq: eqForCache });

  // users/relations birth row 조회 — target_date 기준 yunse 재계산용
  const birthRow = {
    birth_date: '1990-01-01',
    birth_date_calendar: 'solar',
    is_lunar_leap: false,
    birth_time_knowledge: 'unknown',
    birth_time: null,
    gender: 'M',
  };
  const relationBirthRow = { ...birthRow, gender: 'F' };
  const userBirthMaybeSingle = vi.fn().mockResolvedValue({ data: birthRow, error: null });
  const userBirthEq = vi.fn().mockReturnValue({ maybeSingle: userBirthMaybeSingle });
  const userBirthSelect = vi.fn().mockReturnValue({ eq: userBirthEq });

  // relations (birth + nickname 조회) 체인 — opts.relationNickname 미제공 시 null 반환
  const relMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.relationNickname ? { nickname: opts.relationNickname } : null,
    error: null,
  });
  const relationBirthMaybeSingle = vi.fn().mockResolvedValue({
    data: relationBirthRow,
    error: null,
  });
  const relSelect = vi.fn().mockImplementation((fields: string) => {
    const maybeSingle = fields.includes('nickname') ? relMaybeSingle : relationBirthMaybeSingle;
    const relEq = vi.fn().mockReturnValue({ maybeSingle });
    return { eq: relEq };
  });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'users') {
      return { select: userBirthSelect };
    }
    if (table === 'relations') {
      return { select: relSelect };
    }
    return { select: selectForCache, insert };
  });

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    insert,
    maybeSingle,
    single,
    relMaybeSingle,
    userBirthMaybeSingle,
    relationBirthMaybeSingle,
  };
}

// --- 기본 service client mock (embeddings/classics mocking은 module 수준) ---
function makeMockServiceClient() {
  return makeMockServiceClientWithSnapshot().client;
}

// --- ragQueryText mock ---
const ragQueryText = vi.fn().mockReturnValue('테스트 RAG 쿼리');

// --- OpenAI client mock (embeddings + chat) ---
const embeddingsClient = { create: vi.fn() };

function makeDeps(userClient: SupabaseClient, serviceClient?: SupabaseClient): BuildHapcardDeps {
  return {
    supabaseUserClient: userClient,
    supabaseServiceClient: serviceClient ?? makeMockServiceClient(),
    openaiClient: { chat: { completions: { create: vi.fn() } } },
    embeddingsClient,
    ragQueryText,
  };
}

// --- 공통 모듈 mock 설정 ---
beforeEach(() => {
  vi.clearAllMocks();

  (computeScore as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_SCORE);
  (loadPromptForUser as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PROMPT);
  (embedQuery as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_EMBEDDING);
  (retrieveClassics as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_LLM_RESULT);
  (validateClassicCitations as ReturnType<typeof vi.fn>).mockReturnValue({ valid: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildHapcard — 오늘 케미 빌더 오케스트레이터', () => {
  it('cache hit → 기존 행 반환, callOpenAi 호출 0회, INSERT 0회', async () => {
    const existingRow = makeInsertedRow(EXPECTED_CACHE_KEY);
    const { client, insert } = makeMockUserClient({ cachedRow: existingRow });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.hapcard_id).toBe(existingRow.hapcard_id);
    expect(callOpenAi).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('cache hit row가 요청 relation_id와 다르면 stale cache로 보고 반환하지 않는다', async () => {
    const staleRow = {
      ...makeInsertedRow(EXPECTED_CACHE_KEY),
      relation_id: 'rel-other',
    };
    const { client, insert } = makeMockUserClient({
      cachedRow: staleRow,
      relationNickname: '현재 인연',
    });

    await expect(buildHapcard(BASE_INPUT, makeDeps(client))).rejects.toThrow('HAPCARD_CACHE_MISMATCH');

    expect(callOpenAi).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('cache hit row가 fallback llm_model이어도 cache_key가 현재 routed model 기준이면 반환한다', async () => {
    const fallbackRow = {
      ...makeInsertedRow(EXPECTED_CACHE_KEY),
      llm_model: 'claude-fallback' as const,
    };
    const { client, insert } = makeMockUserClient({ cachedRow: fallbackRow });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.hapcard_id).toBe(fallbackRow.hapcard_id);
    expect(result.llm_model).toBe('claude-fallback');
    expect(callOpenAi).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('cache miss → 전체 파이프라인 실행 → INSERT 1회 → 반환', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(callOpenAi).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(result.hapcard_id).toBeDefined();
  });

  it('cache miss insert race → cache 재조회로 복구하고 fromCache 반환', async () => {
    const existingRow = makeInsertedRow(EXPECTED_CACHE_KEY);
    const { client, maybeSingle, single } = makeMockUserClient({ cachedRow: null });
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: existingRow, error: null });
    single.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    });

    const result = await buildHapcardWithMeta(BASE_INPUT, makeDeps(client));

    expect(result.fromCache).toBe(true);
    expect(result.result.hapcard_id).toBe(existingRow.hapcard_id);
  });

  it('compat_score는 항상 computeScore 결과 (LLM 응답에 score 없음)', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.compat_score).toBe(MOCK_SCORE.score);
    expect(computeScore).toHaveBeenCalledWith({
      self: expect.objectContaining({
        day_pillar: BASE_INPUT.self.day_pillar,
        yunse: expect.objectContaining({
          iliun: expect.objectContaining({ today_date: BASE_INPUT.target_date }),
        }),
      }),
      relation: expect.objectContaining({
        day_pillar: BASE_INPUT.relation.day_pillar,
        yunse: expect.objectContaining({
          iliun: expect.objectContaining({ today_date: BASE_INPUT.target_date }),
        }),
      }),
      mode: BASE_INPUT.mode,
    });
  });

  it('score_breakdown 5개 필드 (hap_chung_hyung_hae, sipsin, ohaeng, yunse_adjustment, mode_adjustment)', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.score_breakdown).toEqual({
      hap_chung_hyung_hae: MOCK_SCORE.components.hap_chung_hyung_hae,
      sipsin: MOCK_SCORE.components.sipsin,
      ohaeng: MOCK_SCORE.components.ohaeng,
      yunse_adjustment: MOCK_SCORE.yunse_adjustment,
      mode_adjustment: MOCK_SCORE.mode_adjustment,
    });
  });

  it('cache_key = sha256(relation_id + self_hash + rel_hash + mode + prompt.version + llm_model + theory_profile_version + target_date)', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const insertCall = insert.mock.calls[0][0];
    expect(insertCall.cache_key).toBe(EXPECTED_CACHE_KEY);
  });

  it('prompt_version은 loadPromptForUser 결과의 version 필드', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const insertCall = insert.mock.calls[0][0];
    expect(insertCall.prompt_version).toBe(MOCK_PROMPT.version);
  });

  it('케미카드 모델은 gpt-5로 호출하고 저장한다', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const callArgs = (callOpenAi as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const insertCall = insert.mock.calls[0][0];
    expect(callArgs.model).toBe('gpt-5');
    expect(insertCall.llm_model).toBe('gpt-5');
  });

  it('grounding 실패(errors.length>0) → 1회 retry → 2차 성공', async () => {
    (validateClassicCitations as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ valid: false, errors: [{ reason: 'RAG_CLASSIC_MISS', asset_id: 'x', index: 0 }] })
      .mockReturnValueOnce({ valid: true });

    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(callOpenAi).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('grounding 2회 실패 → GROUNDING_FAILED throw, INSERT 없음', async () => {
    const errors = [{ reason: 'RAG_CLASSIC_MISS' as const, asset_id: 'x', index: 0 }];
    (validateClassicCitations as ReturnType<typeof vi.fn>)
      .mockReturnValue({ valid: false, errors });

    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await expect(buildHapcard(BASE_INPUT, makeDeps(client))).rejects.toThrow('GROUNDING_FAILED');

    expect(callOpenAi).toHaveBeenCalledTimes(2);
    expect(insert).not.toHaveBeenCalled();
  });

  it('RAG hits 0개 → classic_citation 빈 배열 → grounding skipped → INSERT 정상', async () => {
    (retrieveClassics as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (validateClassicCitations as ReturnType<typeof vi.fn>).mockReturnValue({ valid: true, skipped: true });

    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('RAG hits 보유 시 systemPrompt 에 ## Available RAG hits 헤더 + <rag_hits> 블록 포함', async () => {
    const hits = [
      {
        asset_id: 'classic_test_001',
        source_title: '테스트',
        source_chapter: '편',
        original_text: '原文',
        original_reading: '원문',
        modern_translation: '현대역',
        similarity: 0.9,
      },
    ];
    (retrieveClassics as ReturnType<typeof vi.fn>).mockResolvedValue(hits);

    const { client } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const callArgs = (callOpenAi as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain('## Available RAG hits');
    expect(callArgs.systemPrompt).toContain('<rag_hits>');
    expect(callArgs.systemPrompt).toContain('classic_test_001');
  });

  it('RAG hits 0건 시 systemPrompt 에 No classical references match + classic_citation: [] 안내 포함', async () => {
    (retrieveClassics as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { client } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const callArgs = (callOpenAi as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain('No classical references match');
    expect(callArgs.systemPrompt).toContain('classic_citation: []');
    expect(callArgs.systemPrompt).not.toContain('<rag_hits>');
  });

  it('ragQueryText 함수가 input을 받고 string 반환 → embedQuery 인자로 전달', async () => {
    const queryFn = vi.fn().mockReturnValue('내 RAG 쿼리');
    const { client } = makeMockUserClient({ cachedRow: null });
    const deps = { ...makeDeps(client), ragQueryText: queryFn };

    await buildHapcard(BASE_INPUT, deps);

    expect(queryFn).toHaveBeenCalledWith(expect.objectContaining({
      user_id: BASE_INPUT.user_id,
      relation_id: BASE_INPUT.relation_id,
      mode: BASE_INPUT.mode,
      target_date: BASE_INPUT.target_date,
      self_chart_hash: BASE_INPUT.self_chart_hash,
      relation_chart_hash: BASE_INPUT.relation_chart_hash,
      theory_profile_version: BASE_INPUT.theory_profile_version,
      self: expect.objectContaining({
        yunse: expect.objectContaining({
          iliun: expect.objectContaining({ today_date: BASE_INPUT.target_date }),
        }),
      }),
      relation: expect.objectContaining({
        yunse: expect.objectContaining({
          iliun: expect.objectContaining({ today_date: BASE_INPUT.target_date }),
        }),
      }),
    }));
    expect(embedQuery).toHaveBeenCalledWith('내 RAG 쿼리', expect.anything());
  });

  it('callOpenAi에 supabaseServiceClient 전달 (cost tracking은 callOpenAi 내부)', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });
    const deps = makeDeps(client);

    await buildHapcard(BASE_INPUT, deps);

    const callArgs = (callOpenAi as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.supabaseServiceRole).toBe(deps.supabaseServiceClient);
  });

  it('LLM payload에 target_date와 날짜별 yunse를 전달한다', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const callArgs = (callOpenAi as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.userPayload.time_context).toEqual({ target_date: BASE_INPUT.target_date });
    expect(callArgs.userPayload.self_chart_core.yunse.iliun.today_date).toBe(BASE_INPUT.target_date);
    expect(callArgs.userPayload.relation_chart_core.yunse.iliun.today_date).toBe(BASE_INPUT.target_date);
  });

  it('INSERT row에 user_id, relation_id, mode, user_chart_hash, relation_chart_hash 포함', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const row = insert.mock.calls[0][0];
    expect(row.user_id).toBe(BASE_INPUT.user_id);
    expect(row.relation_id).toBe(BASE_INPUT.relation_id);
    expect(row.mode).toBe(BASE_INPUT.mode);
    expect(row.target_date).toBe(BASE_INPUT.target_date);
    expect(row.user_chart_hash).toBe(BASE_INPUT.self_chart_hash);
    expect(row.relation_chart_hash).toBe(BASE_INPUT.relation_chart_hash);
  });

  it('cache miss → LLM ohaeng_interpretation을 content에 저장', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const row = insert.mock.calls[0][0];
    expect(row.content.ohaeng_interpretation).toEqual(MOCK_OHAENG_INTERPRETATION);
  });

  it('cache miss → 반환된 HapcardResult에 visuals 첨부 (user/relation 슬라이스)', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.visuals).toBeDefined();
    expect(result.visuals?.user.day_pillar).toBe(SELF.day_pillar);
    expect(result.visuals?.user.day_master_element).toBe(SELF.day_master_element);
    expect(result.visuals?.relation.day_pillar).toBe(RELATION.day_pillar);
    expect(result.visuals?.relation.day_master_element).toBe(RELATION.day_master_element);
  });

  it('cache hit → 반환된 HapcardResult에 visuals 첨부 (DB 데이터 + visuals 병합)', async () => {
    const existingRow = makeInsertedRow(EXPECTED_CACHE_KEY);
    const { client } = makeMockUserClient({ cachedRow: existingRow });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.visuals).toBeDefined();
    expect(result.visuals?.user.day_pillar).toBe(SELF.day_pillar);
    expect(result.visuals?.relation.day_pillar).toBe(RELATION.day_pillar);
  });

  it('cache miss → relation_nickname (relations.nickname 조회 결과)', async () => {
    const { client } = makeMockUserClient({
      cachedRow: null,
      relationNickname: '하늘이',
    });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.relation_nickname).toBe('하늘이');
  });

  it('cache hit → relation_nickname (relations.nickname 조회 결과)', async () => {
    const existingRow = makeInsertedRow(EXPECTED_CACHE_KEY);
    const { client } = makeMockUserClient({
      cachedRow: existingRow,
      relationNickname: '바다',
    });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.relation_nickname).toBe('바다');
  });

  it('cache miss → relation_gender_normalized (input.relation.gender_normalized)', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.relation_gender_normalized).toBe(RELATION.gender_normalized);
  });

  it('cache hit → relation_gender_normalized (input.relation.gender_normalized)', async () => {
    const existingRow = makeInsertedRow(EXPECTED_CACHE_KEY);
    const { client } = makeMockUserClient({ cachedRow: existingRow });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.relation_gender_normalized).toBe(RELATION.gender_normalized);
  });

  it('relations.nickname 조회 실패 (data null) → relation_nickname undefined', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.relation_nickname).toBeUndefined();
  });

  // Cycle 7 — snapshot upsert (ADR-036)
  it('cache miss → hapcard_score_snapshots upsert 1회', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });
    const { client: svcClient, snapshotUpsert } = makeMockServiceClientWithSnapshot();

    await buildHapcard(BASE_INPUT, makeDeps(client, svcClient));

    expect(snapshotUpsert).toHaveBeenCalledTimes(1);
    const row = snapshotUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.user_id).toBe(BASE_INPUT.user_id);
    expect(row.relation_id).toBe(BASE_INPUT.relation_id);
    expect(row.mode).toBe(BASE_INPUT.mode);
    expect(row.compat_score).toBe(MOCK_SCORE.score);
    expect(row.scoring_version).toBe('1');
    expect(row.prompt_version).toBe(MOCK_PROMPT.version);
    expect(row.target_date).toBe(BASE_INPUT.target_date);
  });

  it('hapcard_score_snapshots upsert 실패 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });
    const { client: svcClient, snapshotUpsert } = makeMockServiceClientWithSnapshot();
    snapshotUpsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'snapshot failed birth_date=1995-06-15 birth_time=10:30:00 gender=F' },
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await buildHapcard(BASE_INPUT, makeDeps(client, svcClient));

    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1995-06-15');
    expect(calls).not.toContain('10:30:00');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });

  it('cache hit → hapcard_score_snapshots upsert 0회', async () => {
    const existingRow = makeInsertedRow(EXPECTED_CACHE_KEY);
    const { client } = makeMockUserClient({ cachedRow: existingRow });
    const { client: svcClient, snapshotUpsert } = makeMockServiceClientWithSnapshot();

    await buildHapcard(BASE_INPUT, makeDeps(client, svcClient));

    expect(snapshotUpsert).not.toHaveBeenCalled();
  });

  // Phase B T3 — classic_citation Korean 변환
  it('classic_citation RAG hit 있음 → source는 한글화, original은 ragHit.original_reading 우선', async () => {
    // RAG hit: asset_id 매칭, original_reading 보유
    const ragHit = {
      asset_id: 'classic_dts_001',
      // ragHit.source_title은 builder에서 미사용 — source는 LLM citation.source_title 기반
      source_title: '滴天髓(적천수)',
      source_chapter: '通神頌',
      original_text: '官多者身弱, 食傷可用',
      original_reading: '관다자신약, 식상가용',
      modern_translation: '관살이 많으면 신약하니 식상을 쓸 수 있다',
      topic_tags: ['관살', '식상'],
      similarity: 0.92,
      tier: 'required' as const,
    };
    (retrieveClassics as ReturnType<typeof vi.fn>).mockResolvedValue([ragHit]);
    (validateClassicCitations as ReturnType<typeof vi.fn>).mockReturnValue({ valid: true });
    (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_LLM_RESULT,
      output: {
        ...MOCK_LLM_OUTPUT,
        classic_citation: [
          {
            asset_id: 'classic_dts_001',
            // source_title에 Hanja-in-parens 역순(Hanja first) → stripHanjaInParens는 유지
            // 단 한글이 앞인 "한글(漢字)" 형식만 제거
            source_title: '적천수(滴天髓)',
            // '通神頌' → CHAPTER_READINGS 매핑 → '통신송'
            source_chapter: '通神頌',
            original_text: '官多者身弱, 食傷可用',
            modern_translation: '관살이 많으면 신약하니 식상을 쓸 수 있다',
          },
        ],
      },
    });

    const { client, insert } = makeMockUserClient({ cachedRow: null });
    await buildHapcard(BASE_INPUT, makeDeps(client));

    const insertCall = insert.mock.calls[0][0];
    const citations = insertCall.content.classic_citation as Array<{ source: string; original: string; modern: string }>;
    expect(citations).toHaveLength(1);
    // source_title '적천수(滴天髓)' → stripHanjaInParens → '적천수', chapter '通神頌' → '통신송'
    expect(citations[0].source).toBe('적천수 통신송');
    // ragHit.original_reading 우선 사용
    expect(citations[0].original).toBe('관다자신약, 식상가용');
    // modern_translation은 그대로
    expect(citations[0].modern).toBe('관살이 많으면 신약하니 식상을 쓸 수 있다');
  });

  it('classic_citation RAG miss → original은 convertHanja(original_text) 폴백', async () => {
    // RAG hit 없음 (다른 asset_id로 매칭 불가)
    const ragHit = {
      asset_id: 'classic_other_999',
      source_title: '다른 문헌',
      source_chapter: '序',
      original_text: '不相關',
      original_reading: '불상관',
      modern_translation: '무관함',
      topic_tags: [],
      similarity: 0.3,
      tier: 'optional' as const,
    };
    (retrieveClassics as ReturnType<typeof vi.fn>).mockResolvedValue([ragHit]);
    (validateClassicCitations as ReturnType<typeof vi.fn>).mockReturnValue({ valid: true });
    (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_LLM_RESULT,
      output: {
        ...MOCK_LLM_OUTPUT,
        classic_citation: [
          {
            asset_id: 'classic_dts_002', // 매칭 ragHit 없음 → convertHanja 폴백
            source_title: '자평진전(子平眞詮)',
            source_chapter: '神煞論',
            // 甲子 → convertHanja → '갑자' (甲→갑, 子→자)
            original_text: '甲子',
            modern_translation: '갑자년',
          },
        ],
      },
    });

    const { client, insert } = makeMockUserClient({ cachedRow: null });
    await buildHapcard(BASE_INPUT, makeDeps(client));

    const insertCall = insert.mock.calls[0][0];
    const citations = insertCall.content.classic_citation as Array<{ source: string; original: string; modern: string }>;
    expect(citations).toHaveLength(1);
    // ragHit 없으므로 convertHanja('甲子') 폴백 → '갑자'
    expect(citations[0].original).toBe('갑자');
    // modern은 그대로
    expect(citations[0].modern).toBe('갑자년');
  });
});
