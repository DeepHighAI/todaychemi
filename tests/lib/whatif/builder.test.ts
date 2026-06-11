import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildWhatif } from '@/lib/whatif/builder';
import type { BuildWhatifDeps } from '@/lib/whatif/builder';
import { deriveCacheKey } from '@/lib/whatif/cache-key';
import {
  MOCK_CHART_CORE,
  MOCK_CHART_HASH,
  MOCK_LLM_OUTPUT,
  MOCK_LLM_OUTPUT_WITH_CITATION,
  MOCK_PROMPT_VERSION,
  makeMockInsertedRow,
} from '../../fixtures/whatif';

vi.mock('@/lib/llm/openai', () => ({ callOpenAi: vi.fn() }));
vi.mock('@/lib/whatif/prompt-loader', () => ({ loadWhatifPrompt: vi.fn() }));
vi.mock('@/lib/rag/embeddings', () => ({ embedQuery: vi.fn() }));
vi.mock('@/lib/rag/classics', () => ({ retrieveClassics: vi.fn() }));
vi.mock('@/lib/rag/grounding-validator', () => ({ validateClassicCitations: vi.fn() }));

import { callOpenAi } from '@/lib/llm/openai';
import { loadWhatifPrompt } from '@/lib/whatif/prompt-loader';
import { embedQuery } from '@/lib/rag/embeddings';
import { retrieveClassics } from '@/lib/rag/classics';
import { validateClassicCitations } from '@/lib/rag/grounding-validator';

const mockCallOpenAi = vi.mocked(callOpenAi);
const mockLoadPrompt = vi.mocked(loadWhatifPrompt);
const mockEmbedQuery = vi.mocked(embedQuery);
const mockRetrieveClassics = vi.mocked(retrieveClassics);
const mockValidate = vi.mocked(validateClassicCitations);

const BASE_INPUT = {
  user_id: 'user-uuid-5678',
  type: 'work' as const,
  chart: MOCK_CHART_CORE,
  chart_hash: MOCK_CHART_HASH,
};
const EXPECTED_CACHE_KEY = deriveCacheKey({
  chart_hash: MOCK_CHART_HASH,
  type: 'work',
  prompt_version: MOCK_PROMPT_VERSION,
  model_id: 'gpt-5-mini',
});

const MOCK_EMBEDDING = Array(1536).fill(0.1) as number[];
const MOCK_RAG_HITS: never[] = [];

function makeMockUserClient(opts: {
  cacheHit?: boolean;
  cacheError?: boolean;
  cachedRow?: ReturnType<typeof makeMockInsertedRow>;
  insertError?: boolean;
  insertRaceConflict?: boolean;
}) {
  const row = opts.cachedRow ?? makeMockInsertedRow(EXPECTED_CACHE_KEY);
  const dbRow = { whatif_id: row.id, ...row };

  const maybySingle = vi.fn().mockResolvedValue(
    opts.cacheError
      ? { data: null, error: { message: 'cache lookup down' } }
      : opts.cacheHit
        ? { data: dbRow, error: null }
        : { data: null, error: null },
  );
  const eqChain = { maybeSingle: maybySingle };
  const selectChain = { eq: vi.fn().mockReturnValue(eqChain) };
  const selectFn = vi.fn().mockReturnValue(selectChain);

  const single = vi.fn().mockResolvedValue(
    opts.insertRaceConflict
      ? { data: null, error: { code: '23505', message: 'duplicate key' } }
      : opts.insertError
        ? { data: null, error: { code: 'OTHER', message: 'db error' } }
        : { data: dbRow, error: null },
  );
  const insertSelectChain = { single };
  const insertChain = { select: vi.fn().mockReturnValue(insertSelectChain) };
  const insertFn = vi.fn().mockReturnValue(insertChain);

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'whatif_results') {
      return { select: selectFn, insert: insertFn };
    }
    return {};
  });

  return { client: { from } as unknown as SupabaseClient, from, maybySingle, insertFn, single };
}

function makeMockServiceClient() {
  return { from: vi.fn().mockReturnValue({}) } as unknown as SupabaseClient;
}

const ragQueryText = vi.fn().mockReturnValue('work query text');
const embeddingsClient = { create: vi.fn() };

function makeDeps(userClient: SupabaseClient, serviceClient?: SupabaseClient): BuildWhatifDeps {
  return {
    supabaseUserClient: userClient,
    supabaseServiceClient: serviceClient ?? makeMockServiceClient(),
    openaiClient: { chat: { completions: { create: vi.fn() } } },
    embeddingsClient,
    ragQueryText,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadPrompt.mockReturnValue({ content: '## 시스템 프롬프트', version: MOCK_PROMPT_VERSION });
  mockEmbedQuery.mockResolvedValue(MOCK_EMBEDDING);
  mockRetrieveClassics.mockResolvedValue(MOCK_RAG_HITS);
  mockCallOpenAi.mockResolvedValue({
    output: MOCK_LLM_OUTPUT,
    usage: { token_in: 100, token_out: 200, total_usd: 0 },
    model: 'gpt-5',
  });
  mockValidate.mockReturnValue({ valid: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildWhatif', () => {
  it('cache hit → 기존 row 반환, callOpenAi 0회, INSERT 0회', async () => {
    const { client, insertFn } = makeMockUserClient({ cacheHit: true });
    const { result } = await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(mockCallOpenAi).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
    expect(result.id).toBeDefined();
  });

  it('cache hit row가 요청 type과 다르면 stale cache로 보고 반환하지 않는다', async () => {
    const staleRow = {
      ...makeMockInsertedRow(EXPECTED_CACHE_KEY),
      type: 'love' as const,
    };
    const { client, insertFn } = makeMockUserClient({
      cacheHit: true,
      cachedRow: staleRow,
    });

    await expect(buildWhatif(BASE_INPUT, makeDeps(client))).rejects.toThrow('WHATIF_CACHE_MISMATCH');

    expect(mockCallOpenAi).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
  });

  it('cache hit row가 현재 llm_model과 다르면 stale cache로 보고 반환하지 않는다', async () => {
    const staleRow = {
      ...makeMockInsertedRow(EXPECTED_CACHE_KEY),
      llm_model: 'gpt-5',
    };
    const { client, insertFn } = makeMockUserClient({
      cacheHit: true,
      cachedRow: staleRow,
    });

    await expect(buildWhatif(BASE_INPUT, makeDeps(client))).rejects.toThrow('WHATIF_CACHE_MISMATCH');

    expect(mockCallOpenAi).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
  });

  it('cache lookup error → LLM/INSERT 없이 WHATIF_CACHE_LOOKUP_FAILED', async () => {
    const { client, insertFn } = makeMockUserClient({ cacheError: true });

    await expect(buildWhatif(BASE_INPUT, makeDeps(client))).rejects.toThrow(
      'WHATIF_CACHE_LOOKUP_FAILED',
    );

    expect(mockCallOpenAi).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
  });

  it('cache miss → 전체 파이프라인 → INSERT 1회 → id 반환', async () => {
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    const { result } = await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(mockCallOpenAi).toHaveBeenCalledTimes(1);
    expect(insertFn).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('whatif-uuid-1234');
    expect(result.type).toBe('work');
  });

  it('cache_key = deriveCacheKey(chart_hash, type, prompt_version, model_id)', async () => {
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const expectedKey = deriveCacheKey({
      chart_hash: MOCK_CHART_HASH,
      type: 'work',
      prompt_version: MOCK_PROMPT_VERSION,
      model_id: 'gpt-5-mini',
    });
    const insertArgs = insertFn.mock.calls[0][0];
    expect(insertArgs.cache_key).toBe(expectedKey);
  });

  it('prompt_version = loadWhatifPrompt 결과 version', async () => {
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(insertFn.mock.calls[0][0].prompt_version).toBe(MOCK_PROMPT_VERSION);
  });

  it('llm_model = DEFAULT_LLM_MODEL 고정', async () => {
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(insertFn.mock.calls[0][0].llm_model).toBe('gpt-5-mini');
  });

  it('INSERT row에 user_id, type, chart_hash 포함 (relation_id 없음)', async () => {
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const row = insertFn.mock.calls[0][0];
    expect(row.user_id).toBe(BASE_INPUT.user_id);
    expect(row.type).toBe('work');
    expect(row.chart_hash).toBe(MOCK_CHART_HASH);
    expect(row).not.toHaveProperty('relation_id');
    expect(row).not.toHaveProperty('compat_score');
  });

  it('grounding 1차 실패 → retry → 2차 성공 → INSERT 1회', async () => {
    mockValidate
      .mockReturnValueOnce({ valid: false, errors: [{ reason: 'RAG_CLASSIC_MISS', asset_id: 'a', index: 0 }] })
      .mockReturnValueOnce({ valid: true });
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(mockCallOpenAi).toHaveBeenCalledTimes(2);
    expect(insertFn).toHaveBeenCalledTimes(1);
  });

  it('grounding 2회 실패 → GROUNDING_FAILED throw', async () => {
    mockValidate.mockReturnValue({ valid: false, errors: [{ reason: 'RAG_CLASSIC_MISS', asset_id: 'a', index: 0 }] });
    const { client } = makeMockUserClient({ cacheHit: false });
    await expect(buildWhatif(BASE_INPUT, makeDeps(client))).rejects.toThrow('GROUNDING_FAILED');
  });

  it('RAG hits 0개 → validateClassicCitations 호출 → grounding skipped → INSERT 정상', async () => {
    mockRetrieveClassics.mockResolvedValue([]);
    mockValidate.mockReturnValue({ valid: true, skipped: true });
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(mockValidate).toHaveBeenCalled();
    expect(insertFn).toHaveBeenCalledTimes(1);
  });

  it('callOpenAi에 supabaseServiceClient 전달', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    const serviceClient = makeMockServiceClient();
    await buildWhatif(BASE_INPUT, makeDeps(client, serviceClient));
    expect(mockCallOpenAi.mock.calls[0][1].supabaseServiceRole).toBe(serviceClient);
  });

  it('ragQueryText가 input을 받아 string 반환', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(ragQueryText).toHaveBeenCalledWith(expect.objectContaining({ type: 'work' }));
  });

  it('D4 race: INSERT 23505 → SELECT 재실행 → 기존 row 반환, callOpenAi 1회만', async () => {
    const { client, maybySingle } = makeMockUserClient({ insertRaceConflict: true });
    const row = makeMockInsertedRow(EXPECTED_CACHE_KEY);
    const dbRow = { whatif_id: row.id, ...row };
    maybySingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: dbRow, error: null });
    const { result } = await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(mockCallOpenAi).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('whatif-uuid-1234');
  });

  it('INSERT 기타 에러 → WHATIF_INSERT_FAILED throw', async () => {
    const { client } = makeMockUserClient({ insertError: true });
    await expect(buildWhatif(BASE_INPUT, makeDeps(client))).rejects.toThrow('WHATIF_INSERT_FAILED');
  });

  it('type=first_meet → loadWhatifPrompt("first_meet") 호출', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif({ ...BASE_INPUT, type: 'first_meet' }, makeDeps(client));
    expect(mockLoadPrompt).toHaveBeenCalledWith('first_meet');
  });

  it('cache miss → { result, fromCache: false } 반환 구조', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    const { result, fromCache } = await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(fromCache).toBe(false);
    expect(result.id).toBe('whatif-uuid-1234');
  });

  it('cache hit → { result, fromCache: true } 반환 구조', async () => {
    const { client } = makeMockUserClient({ cacheHit: true });
    const { result, fromCache } = await buildWhatif(BASE_INPUT, makeDeps(client));
    expect(fromCache).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('LLM이 classic_citation 반환 → INSERT content.classic_citation 길이 1', async () => {
    mockCallOpenAi.mockResolvedValue({
      output: MOCK_LLM_OUTPUT_WITH_CITATION,
      usage: { token_in: 100, token_out: 200, total_usd: 0 },
      model: 'gpt-5',
    });
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const content = insertFn.mock.calls[0][0].content;
    expect(content.classic_citation).toHaveLength(1);
    expect(content.classic_citation[0].asset_id).toBe('asset-1');
  });

  it('LLM이 classic_citation 미반환 → INSERT content.classic_citation undefined', async () => {
    const { client, insertFn } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const content = insertFn.mock.calls[0][0].content;
    expect(content.classic_citation).toBeUndefined();
  });
});

describe('buildWhatif — PII 가드 (AGENTS.md §5)', () => {
  it('DB chart_core에 런타임 extra PII 키가 섞여도 callOpenAi userPayload에서 제거한다', async () => {
    const chartWithPii = {
      ...MOCK_CHART_CORE,
      birth_date: '1990-01-01',
      nickname: '민감한별명',
      email: 'secret@example.com',
      birth_place: 'Seoul',
      gender: 'M',
    } as unknown as typeof MOCK_CHART_CORE;
    const { client } = makeMockUserClient({ cacheHit: false });

    await buildWhatif({ ...BASE_INPUT, chart: chartWithPii }, makeDeps(client));

    const callInput = mockCallOpenAi.mock.calls[0][0];
    const json = JSON.stringify(callInput.userPayload);
    expect(json).not.toMatch(/birth_date/i);
    expect(json).not.toMatch(/nickname/i);
    expect(json).not.toMatch(/email/i);
    expect(json).not.toMatch(/birth_place/i);
    expect(json).not.toMatch(/"gender"/);
    expect(json).not.toContain('secret@example.com');
    expect(json).not.toContain('민감한별명');
  });

  it('callOpenAi userPayload JSON에 birth_date 없음', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const callInput = mockCallOpenAi.mock.calls[0][0];
    expect(JSON.stringify(callInput.userPayload)).not.toMatch(/birth_date/i);
  });

  it('callOpenAi userPayload JSON에 nickname 없음', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const callInput = mockCallOpenAi.mock.calls[0][0];
    expect(JSON.stringify(callInput.userPayload)).not.toMatch(/nickname/i);
  });

  it('callOpenAi userPayload JSON에 email 없음', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const callInput = mockCallOpenAi.mock.calls[0][0];
    expect(JSON.stringify(callInput.userPayload)).not.toMatch(/email/i);
  });

  it('callOpenAi userPayload JSON에 birth_place 없음', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const callInput = mockCallOpenAi.mock.calls[0][0];
    expect(JSON.stringify(callInput.userPayload)).not.toMatch(/birth_place/i);
  });

  it('payloadWhitelist = {self_chart_core, type} — PII 키 포함 안 됨', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const callInput = mockCallOpenAi.mock.calls[0][0];
    const wl = callInput.payloadWhitelist as Set<string>;
    expect(wl.has('self_chart_core')).toBe(true);
    expect(wl.has('type')).toBe(true);
    expect(wl.has('birth_date')).toBe(false);
    expect(wl.has('nickname')).toBe(false);
    expect(wl.has('email')).toBe(false);
    expect(wl.has('name')).toBe(false);
    expect(wl.size).toBe(2);
  });
});

describe('buildWhatif — derived 압축 projection (P3)', () => {
  interface WhatifPayloadShape {
    self_chart_core: {
      derived?: Record<string, unknown> & { sinkang?: Record<string, unknown> };
    };
  }

  it('self_chart_core.derived 압축 LlmDerived 포함 (sinkang verdict만, 숫자 score 부재)', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const callInput = mockCallOpenAi.mock.calls[0][0];
    const derived = (callInput.userPayload as unknown as WhatifPayloadShape).self_chart_core
      .derived;
    expect(derived).toBeDefined();
    expect(Object.keys(derived!).sort()).toEqual([
      'dominant_sipsin',
      'jijanggan_elements',
      'missing_sipsin',
      'sinkang',
      'sipsin_distribution',
      'yinyang',
      'yongsin_candidates',
      'zodiac_animal',
    ]);
    expect(Object.keys(derived!.sinkang!)).toEqual(['verdict']);
    expect(JSON.stringify(callInput.userPayload)).not.toMatch(/"score"/);
  });

  it('cross_analysis 부재 + 화이트리스트 2키 불변 (자기진단 — 교차 대상 없음)', async () => {
    const { client } = makeMockUserClient({ cacheHit: false });
    await buildWhatif(BASE_INPUT, makeDeps(client));
    const callInput = mockCallOpenAi.mock.calls[0][0];
    const payload = callInput.userPayload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['self_chart_core', 'type']);
    expect('cross_analysis' in payload).toBe(false);
    expect(
      'cross_analysis' in (payload.self_chart_core as Record<string, unknown>),
    ).toBe(false);
    const wl = callInput.payloadWhitelist as Set<string>;
    expect(wl.size).toBe(2);
    expect(wl.has('cross_analysis')).toBe(false);
  });
});
