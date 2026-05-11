import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock은 최상단에 호이스팅됨
vi.mock('@/lib/scoring/index', () => ({
  computeScore: vi.fn(),
}));
vi.mock('@/lib/llm/prompt-loader', () => ({
  loadActivePrompt: vi.fn(),
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

import { buildHapcard } from '@/lib/hapcard/builder';
import { computeScore } from '@/lib/scoring/index';
import { loadActivePrompt } from '@/lib/llm/prompt-loader';
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

const MOCK_LLM_OUTPUT = {
  main_text: '갑목일간'.repeat(40).slice(0, 160),
  cause_factors: [
    { name: '원인1', effect: '결과1' },
    { name: '원인2', effect: '결과2' },
    { name: '원인3', effect: '결과3' },
  ],
  classic_citation: [],
  actions: ['행동1', '행동2', '행동3'],
  why_cards: [{ title: '제목1', reason: '이유1' }],
};

const MOCK_LLM_RESULT = {
  output: MOCK_LLM_OUTPUT,
  usage: { token_in: 100, token_out: 200, total_usd: 0 },
  model: 'gpt-5' as const,
};

const EXPECTED_CACHE_KEY = deriveCacheKey({
  user_chart_hash: BASE_INPUT.self_chart_hash,
  relation_chart_hash: BASE_INPUT.relation_chart_hash,
  mode: BASE_INPUT.mode,
  prompt_version: MOCK_PROMPT.version,
  theory_profile_version: BASE_INPUT.theory_profile_version,
});

// DB 삽입 후 반환될 행
function makeInsertedRow(cacheKey: string): HapcardResult {
  return {
    hapcard_id: 'hapcard-uuid-001',
    user_id: BASE_INPUT.user_id,
    relation_id: BASE_INPUT.relation_id,
    mode: BASE_INPUT.mode,
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

  // relations (nickname 조회) 체인 — opts.relationNickname 미제공 시 null 반환
  const relMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.relationNickname ? { nickname: opts.relationNickname } : null,
    error: null,
  });
  const relEq = vi.fn().mockReturnValue({ maybeSingle: relMaybeSingle });
  const relSelect = vi.fn().mockReturnValue({ eq: relEq });

  const from = vi.fn().mockImplementation((table: string) => {
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
  (loadActivePrompt as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PROMPT);
  (embedQuery as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_EMBEDDING);
  (retrieveClassics as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (callOpenAi as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_LLM_RESULT);
  (validateClassicCitations as ReturnType<typeof vi.fn>).mockReturnValue({ valid: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildHapcard — 합카드 빌더 오케스트레이터', () => {
  it('cache hit → 기존 행 반환, callOpenAi 호출 0회, INSERT 0회', async () => {
    const existingRow = makeInsertedRow(EXPECTED_CACHE_KEY);
    const { client, insert } = makeMockUserClient({ cachedRow: existingRow });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.hapcard_id).toBe(existingRow.hapcard_id);
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

  it('compat_score는 항상 computeScore 결과 (LLM 응답에 score 없음)', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });

    const result = await buildHapcard(BASE_INPUT, makeDeps(client));

    expect(result.compat_score).toBe(MOCK_SCORE.score);
    expect(computeScore).toHaveBeenCalledWith({
      self: BASE_INPUT.self,
      relation: BASE_INPUT.relation,
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

  it('cache_key = sha256(self_hash + rel_hash + mode + prompt.version + theory_profile_version)', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const insertCall = insert.mock.calls[0][0];
    expect(insertCall.cache_key).toBe(EXPECTED_CACHE_KEY);
  });

  it('prompt_version은 loadActivePrompt 결과의 version 필드', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const insertCall = insert.mock.calls[0][0];
    expect(insertCall.prompt_version).toBe(MOCK_PROMPT.version);
  });

  it('llm_model = DEFAULT_LLM_MODEL 고정', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const insertCall = insert.mock.calls[0][0];
    expect(insertCall.llm_model).toBe('gpt-5-mini');
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

    expect(queryFn).toHaveBeenCalledWith(BASE_INPUT);
    expect(embedQuery).toHaveBeenCalledWith('내 RAG 쿼리', expect.anything());
  });

  it('callOpenAi에 supabaseServiceClient 전달 (cost tracking은 callOpenAi 내부)', async () => {
    const { client } = makeMockUserClient({ cachedRow: null });
    const deps = makeDeps(client);

    await buildHapcard(BASE_INPUT, deps);

    const callArgs = (callOpenAi as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.supabaseServiceRole).toBe(deps.supabaseServiceClient);
  });

  it('INSERT row에 user_id, relation_id, mode, user_chart_hash, relation_chart_hash 포함', async () => {
    const { client, insert } = makeMockUserClient({ cachedRow: null });

    await buildHapcard(BASE_INPUT, makeDeps(client));

    const row = insert.mock.calls[0][0];
    expect(row.user_id).toBe(BASE_INPUT.user_id);
    expect(row.relation_id).toBe(BASE_INPUT.relation_id);
    expect(row.mode).toBe(BASE_INPUT.mode);
    expect(row.user_chart_hash).toBe(BASE_INPUT.self_chart_hash);
    expect(row.relation_chart_hash).toBe(BASE_INPUT.relation_chart_hash);
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
    expect(typeof row.target_date).toBe('string');
    expect(row.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('cache hit → hapcard_score_snapshots upsert 0회', async () => {
    const existingRow = makeInsertedRow(EXPECTED_CACHE_KEY);
    const { client } = makeMockUserClient({ cachedRow: existingRow });
    const { client: svcClient, snapshotUpsert } = makeMockServiceClientWithSnapshot();

    await buildHapcard(BASE_INPUT, makeDeps(client, svcClient));

    expect(snapshotUpsert).not.toHaveBeenCalled();
  });
});
