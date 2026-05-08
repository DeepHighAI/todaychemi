import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- 모듈 mocks (호이스팅) ---
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/hapcard/builder');
vi.mock('@/lib/llm/clients');
vi.mock('@/lib/rag/query-text');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { buildHapcard } from '@/lib/hapcard/builder';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import { buildRagQueryText } from '@/lib/rag/query-text';
import { POST } from '@/app/api/hapcards/route';
import type { ChartCore } from '@/types/chart';
import type { HapcardResult } from '@/types/hapcard';

// --- 픽스처 ---

const SELF_CHART_CORE: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const RELATION_CHART_CORE: ChartCore = {
  year_pillar: '기묘',
  month_pillar: '경진',
  day_pillar: '신사',
  hour_pillar: null,
  day_master_element: '금',
  five_elements_counts: { 목: 0, 화: 0, 토: 2, 금: 2, 수: 0 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const VALID_BODY = {
  relation_id: '550e8400-e29b-41d4-a716-446655440000',
  mode: '일합',
  theory_profile_version: 'v1.0-late_zi',
};

const HAPCARD_RESULT: HapcardResult = {
  hapcard_id: 'hapcard-uuid-001',
  user_id: 'user-uuid-001',
  relation_id: VALID_BODY.relation_id,
  mode: '일합',
  compat_score: 72,
  score_breakdown: {
    hap_chung_hyung_hae: 70,
    sipsin: 75,
    ohaeng: 68,
    yunse_adjustment: 0,
    mode_adjustment: 5,
  },
  content: {
    main_text: '갑목일간',
    cause_factors: [{ name: '원인1', effect: '결과1' }],
    classic_citation: [],
    actions: ['행동1'],
    why_cards: [{ title: '제목', reason: '이유' }],
  },
  prompt_version: 'v0.2',
  llm_model: 'gpt-5o',
  cache_key: 'cache-key-abc',
  user_chart_hash: 'self-hash-abc',
  relation_chart_hash: 'rel-hash-def',
  archived_at: null,
  version_label: null,
  created_at: '2026-05-05T00:00:00Z',
};

// --- mock helpers ---

function makeAuthedSupabaseClient(opts: {
  userId?: string | null;
  userChart?: { chart_core: ChartCore; chart_hash: string } | null;
  relationChart?: { chart_core: ChartCore; chart_hash: string } | null;
  userChartError?: { message: string } | null;
  relationChartError?: { message: string } | null;
}) {
  const userId = opts.userId === undefined ? 'user-uuid-001' : opts.userId;
  const userChart = opts.userChart === undefined
    ? { chart_core: SELF_CHART_CORE, chart_hash: 'self-hash-abc' }
    : opts.userChart;
  const relationChart = opts.relationChart === undefined
    ? { chart_core: RELATION_CHART_CORE, chart_hash: 'rel-hash-def' }
    : opts.relationChart;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  // user_charts query: from('user_charts').select(...).eq('user_id', x).eq('theory_profile_version', y).maybeSingle()
  const userChartMaybeSingle = vi.fn().mockResolvedValue({
    data: userChart,
    error: opts.userChartError ?? null,
  });
  const relationChartMaybeSingle = vi.fn().mockResolvedValue({
    data: relationChart,
    error: opts.relationChartError ?? null,
  });

  // 두 query 모두 .eq().eq().maybeSingle() chain
  const makeChain = (maybeSingle: ReturnType<typeof vi.fn>) => {
    const second = { maybeSingle };
    const firstEq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(second) });
    return { select: vi.fn().mockReturnValue({ eq: firstEq }) };
  };

  const from = vi.fn((table: string) => {
    if (table === 'user_charts') return makeChain(userChartMaybeSingle);
    if (table === 'relation_charts') return makeChain(relationChartMaybeSingle);
    return {
      select: vi.fn(),
      insert: vi.fn(),
    };
  });

  return {
    auth: { getUser },
    from,
  };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/hapcards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const SERVICE_CLIENT = { from: vi.fn() };
const OPENAI_CLIENT = { chat: { completions: { create: vi.fn() } } };
const EMBEDDINGS_CLIENT = { create: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServiceRoleClient).mockReturnValue(SERVICE_CLIENT as never);
  vi.mocked(createOpenAiClient).mockReturnValue(OPENAI_CLIENT as never);
  vi.mocked(createEmbeddingsClient).mockReturnValue(EMBEDDINGS_CLIENT as never);
  vi.mocked(buildRagQueryText).mockReturnValue('테스트 쿼리');
  vi.mocked(buildHapcard).mockResolvedValue(HAPCARD_RESULT);
});

describe('POST /api/hapcards', () => {
  it('200 → HapcardResult JSON 반환 (성공 경로)', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hapcard_id).toBe(HAPCARD_RESULT.hapcard_id);
    expect(body.compat_score).toBe(72);
  });

  it('401 → 미인증 (auth.getUser 가 null user 반환)', async () => {
    const supabase = makeAuthedSupabaseClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('400 → body 가 invalid (relation_id 없음)', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ mode: '일합', theory_profile_version: 'v1.0-late_zi' }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('400 → mode 가 6모드 enum 외 값', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ ...VALID_BODY, mode: '잘못된모드' }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('400 → relation_id 가 UUID 형식 아님', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ ...VALID_BODY, relation_id: 'not-a-uuid' }),
    );

    expect(res.status).toBe(400);
  });

  it('400 → 알 수 없는 필드 거부 (PII 가드 — birth_date 등 차단)', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ ...VALID_BODY, birth_date: '1990-01-01' }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('404 → user_chart 가 해당 theory_profile_version 으로 없음', async () => {
    const supabase = makeAuthedSupabaseClient({ userChart: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('USER_CHART_NOT_FOUND');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('404 → relation_chart 가 해당 relation_id+version 으로 없음', async () => {
    const supabase = makeAuthedSupabaseClient({ relationChart: null });
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('RELATION_CHART_NOT_FOUND');
    expect(buildHapcard).not.toHaveBeenCalled();
  });

  it('500 → buildHapcard 가 unexpected error throw', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildHapcard).mockRejectedValue(new Error('UNEXPECTED: db crashed'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('422 → buildHapcard 가 GROUNDING_FAILED throw', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);
    vi.mocked(buildHapcard).mockRejectedValue(new Error('GROUNDING_FAILED: x'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('GROUNDING_FAILED');
  });

  it('buildHapcard 호출 시 user_id, relation_id, mode, charts, hashes 정확히 전달', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    await POST(makeRequest(VALID_BODY));

    expect(buildHapcard).toHaveBeenCalledTimes(1);
    const [input, deps] = vi.mocked(buildHapcard).mock.calls[0];
    expect(input.user_id).toBe('user-uuid-001');
    expect(input.relation_id).toBe(VALID_BODY.relation_id);
    expect(input.mode).toBe('일합');
    expect(input.self).toEqual(SELF_CHART_CORE);
    expect(input.self_chart_hash).toBe('self-hash-abc');
    expect(input.relation).toEqual(RELATION_CHART_CORE);
    expect(input.relation_chart_hash).toBe('rel-hash-def');
    expect(input.theory_profile_version).toBe('v1.0-late_zi');
    expect(deps.supabaseUserClient).toBe(supabase);
    expect(deps.supabaseServiceClient).toBe(SERVICE_CLIENT);
    expect(deps.openaiClient).toBe(OPENAI_CLIENT);
    expect(deps.embeddingsClient).toBe(EMBEDDINGS_CLIENT);
    expect(deps.ragQueryText).toBe(buildRagQueryText);
  });

  it('question_slot 옵션 필드는 그대로 builder 에 전달', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    await POST(
      makeRequest({ ...VALID_BODY, question_slot: '연애 갈등 해결' }),
    );

    const [input] = vi.mocked(buildHapcard).mock.calls[0];
    expect(input.question_slot).toBe('연애 갈등 해결');
  });

  it('JSON parse 실패 → 400 INVALID_BODY', async () => {
    const supabase = makeAuthedSupabaseClient({});
    vi.mocked(createServerClient).mockResolvedValue(supabase as never);

    const req = new Request('http://localhost/api/hapcards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ invalid json',
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });
});
