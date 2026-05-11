import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock는 최상단에 호이스팅됨 — buildReplay 오케스트레이터 테스트용
vi.mock('@/lib/llm/prompt-loader', () => ({
  loadActivePrompt: vi.fn(),
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
import { loadActivePrompt } from '@/lib/llm/prompt-loader';
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
  const MOCK_HAPCARD: HapcardResult = {
    hapcard_id: 'hapcard-001',
    user_id: 'user-001',
    relation_id: 'rel-001',
    mode: '일합',
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

    // 두 번 연속 .eq() 체인을 지원하는 빌더 — user_charts / relation_charts 공용
    const maybySingle = vi.fn().mockResolvedValue({ data: chartRow, error: null });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle: maybySingle });
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
    (loadActivePrompt as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PROMPT);
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
    const citations = insertCall.content.classic_citation as Array<{ source: string; original: string; modern: string }>;
    expect(citations).toHaveLength(1);
    // source_title '적천수(滴天髓)' → '적천수', source_chapter '通神頌' → '통신송'
    expect(citations[0].source).toBe('적천수 통신송');
    // convertHanja('甲子') → '갑자'
    expect(citations[0].original).toBe('갑자');
    // modern_translation 그대로
    expect(citations[0].modern).toBe('갑자년을 논하다');
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
});
