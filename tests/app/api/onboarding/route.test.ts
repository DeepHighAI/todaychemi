import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/chart/compute');
vi.mock('next/headers');
vi.mock('@/lib/legal/server-consent');
vi.mock('@/lib/supabase/service-role');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { computeChart } from '@/lib/chart/compute';
import { cookies } from 'next/headers';
import { resolveLegalConsentForOnboarding } from '@/lib/legal/server-consent';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { POST } from '@/app/api/onboarding/route';
import type { ChartCore } from '@/types/chart';

const VALID_BODY = {
  nickname: '하늘달',
  birth_date: '1991-03-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '14:30',
  gender: 'F',
};

const VALID_LEGAL_CONSENT = {
  termsVersion: '2026-06-01',
  privacyVersion: '2026-06-01',
  ageConfirmed: true,
  consentedAt: '2026-06-01T00:00:00.000Z',
} as const;

const MOCK_CHART_CORE: ChartCore = {
  year_pillar: '辛未',
  month_pillar: '癸卯',
  day_pillar: '甲戌',
  hour_pillar: '甲申',
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const MOCK_CHART_HASH = 'a'.repeat(64);

function makeClient(opts: {
  userId?: string | null;
  insertError?: { code: string; message: string } | null;
  upsertChartError?: { code: string; message: string } | null;
  existingChartRow?: { chart_id: string } | null;
  existingChartError?: { code: string; message: string } | null;
}) {
  const userId = opts.userId === undefined ? 'user-uuid-001' : opts.userId;

  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: userId
        ? { id: userId }
        : null,
    },
    error: null,
  });

  const insertUsers = vi.fn().mockResolvedValue({
    data: null,
    error: opts.insertError ?? null,
  });

  const upsertCharts = vi.fn().mockResolvedValue({
    data: null,
    error: opts.upsertChartError ?? null,
  });

  const existingChartMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.existingChartRow ?? null,
    error: opts.existingChartError ?? null,
  });
  const existingChartLimit = vi.fn().mockReturnValue({ maybeSingle: existingChartMaybeSingle });
  const existingChartEq = vi.fn().mockReturnValue({ limit: existingChartLimit });
  const selectCharts = vi.fn().mockReturnValue({ eq: existingChartEq });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'users') return { insert: insertUsers };
    if (table === 'user_charts') return { upsert: upsertCharts, select: selectCharts };
    return { insert: vi.fn(), upsert: vi.fn() };
  });

  return {
    auth: { getUser },
    from,
    _insert: insertUsers,
    _upsertCharts: upsertCharts,
    _selectCharts: selectCharts,
    _existingChartEq: existingChartEq,
  };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue({ get: vi.fn(), set: vi.fn() } as never);
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn() } as never);
  vi.mocked(resolveLegalConsentForOnboarding).mockResolvedValue(VALID_LEGAL_CONSENT);
  vi.mocked(computeChart).mockResolvedValue({ chart_core: MOCK_CHART_CORE, chart_hash: MOCK_CHART_HASH });
});

describe('POST /api/onboarding', () => {
  it('200 → users INSERT 성공 (정상 경로)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(client._insert).toHaveBeenCalledOnce();
  });

  it('users INSERT 시 user_id, nickname, birth_date 모두 전달됨', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    await POST(makeRequest(VALID_BODY));

    const inserted = client._insert.mock.calls[0][0];
    expect(inserted.user_id).toBe('user-uuid-001');
    expect(inserted.nickname).toBe('하늘달');
    expect(inserted.birth_date).toBe('1991-03-15');
    expect(inserted.birth_time_knowledge).toBe('exact');
    expect(inserted.gender).toBe('F');
    expect(inserted.consented_tos_version).toBe('2026-06-01');
    expect(inserted.consented_privacy_version).toBe('2026-06-01');
    expect(inserted.consented_at).toBe('2026-06-01T00:00:00.000Z');
    expect(inserted.age_confirmed).toBe(true);
  });

  it('403 → LEGAL_CONSENT_REQUIRED (server consent record 누락)', async () => {
    vi.mocked(resolveLegalConsentForOnboarding).mockResolvedValue(null);
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('LEGAL_CONSENT_REQUIRED');
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('server consent resolver receives service client, cookies, and auth user id', async () => {
    const service = { from: vi.fn() };
    vi.mocked(createServiceRoleClient).mockReturnValue(service as never);
    const cookieStore = { get: vi.fn(), set: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    await POST(makeRequest(VALID_BODY));

    expect(resolveLegalConsentForOnboarding).toHaveBeenCalledWith({
      serviceClient: service,
      cookieStore,
      userId: 'user-uuid-001',
    });
  });

  it('400 → INVALID_BODY (nickname 없음)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const bad = structuredClone(VALID_BODY);
    delete (bad as any).nickname;
    const res = await POST(makeRequest(bad));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY (birth_place 추가 필드 — PII strict 가드)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const bad = { ...VALID_BODY, birth_place: '서울' };
    const res = await POST(makeRequest(bad));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('400 → INVALID_BODY (unknown 시간인데 birth_time 이 남아 있음)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({
      ...VALID_BODY,
      birth_time_knowledge: 'unknown',
      birth_time: '14:30',
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
    expect(client._insert).not.toHaveBeenCalled();
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY (exact 시간인데 birth_time 이 null)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({
      ...VALID_BODY,
      birth_time_knowledge: 'exact',
      birth_time: null,
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
    expect(client._insert).not.toHaveBeenCalled();
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY (solar 날짜에 lunar leap flag true)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({
      ...VALID_BODY,
      birth_date_calendar: 'solar',
      is_lunar_leap: true,
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
    expect(client._insert).not.toHaveBeenCalled();
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('401 → UNAUTHORIZED (미인증)', async () => {
    const client = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('409 → USER_ALREADY_ONBOARDED (duplicate key)', async () => {
    const client = makeClient({
      insertError: { code: '23505', message: 'duplicate key' },
      existingChartRow: { chart_id: 'chart-001' },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('USER_ALREADY_ONBOARDED');
    expect(client._selectCharts).toHaveBeenCalledWith('chart_id');
    expect(client._existingChartEq).toHaveBeenCalledWith('user_id', 'user-uuid-001');
  });

  it('duplicate users row에 chart가 없으면 409 성공으로 위장하지 않는다', async () => {
    const client = makeClient({
      insertError: { code: '23505', message: 'duplicate key' },
      existingChartRow: null,
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('500 → INTERNAL_ERROR (generic DB failure)', async () => {
    const client = makeClient({ insertError: { code: 'PGRST000', message: 'DB down' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('400 → INVALID_BODY on non-JSON body', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(
      new Request('http://localhost/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not json',
      }) as unknown as Parameters<typeof POST>[0],
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('200 성공 시 user_charts upsert 호출 (chart_hash, chart_core, user_id, theory_profile_version)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(client._upsertCharts).toHaveBeenCalledOnce();
    const upserted = client._upsertCharts.mock.calls[0][0];
    expect(upserted.user_id).toBe('user-uuid-001');
    expect(upserted.chart_hash).toBe(MOCK_CHART_HASH);
    expect(upserted.chart_core).toEqual(MOCK_CHART_CORE);
    expect(upserted.theory_profile_version).toBeDefined();
  });

  it('computeChart 실패 → 500, users INSERT 미호출', async () => {
    vi.mocked(computeChart).mockRejectedValue(new Error('KASI timeout'));
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('user_charts upsert 실패 → 500', async () => {
    const client = makeClient({ upsertChartError: { code: 'PGRST000', message: 'upsert fail' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('duplicate users row의 chart 조회 실패도 409 성공으로 위장하지 않는다', async () => {
    const client = makeClient({
      insertError: { code: '23505', message: 'duplicate key' },
      existingChartError: { code: 'PGRST000', message: 'lookup fail' },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
