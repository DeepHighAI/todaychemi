import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/chart/compute');
vi.mock('@/lib/today/kst-date', () => ({ todayKST: () => '2026-05-14' }));

import { createClient as createServerClient } from '@/lib/supabase/server';
import { computeChart } from '@/lib/chart/compute';
import { GET, PATCH } from '@/app/api/me/route';
import type { ChartCore } from '@/types/chart';

const MOCK_CHART_CORE: ChartCore = {
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
    iliun: { today_pillar: '갑자', today_date: '2026-05-07' },
  },
};

const MOCK_CHART_HASH = 'b'.repeat(64);

const MOCK_PROFILE = {
  nickname: '하늘달',
  birth_date: '1991-03-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact' as const,
  birth_time: '14:30',
  gender: 'F',
};

const VALID_UPDATE_BODY = { ...MOCK_PROFILE };

function makeClient(opts: {
  userId?: string | null;
  profileRow?: typeof MOCK_PROFILE | null;
  profileSelectError?: { code: string; message: string } | null;
  updateError?: { code: string; message: string } | null;
  upsertChartError?: { code: string; message: string } | null;
  deleteError?: { code: string; message: string } | null;
}) {
  const userId = opts.userId === undefined ? 'user-uuid-001' : opts.userId;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  // GET profile: from('users').select(...).eq('user_id', uid).maybeSingle()
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.profileRow !== undefined ? opts.profileRow : MOCK_PROFILE,
    error: opts.profileSelectError ?? null,
  });
  const profileEq = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  // PATCH: from('users').update({...}).eq('user_id', uid)
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: opts.updateError ?? null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  // from('user_charts').upsert({...}, { onConflict: 'chart_hash' })
  const upsertCharts = vi.fn().mockResolvedValue({ data: null, error: opts.upsertChartError ?? null });

  // from('daily_haps').delete().eq('user_id', uid).eq('target_date', today)
  const deleteEq2 = vi.fn().mockResolvedValue({ data: null, error: opts.deleteError ?? null });
  const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
  const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq1 });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'users') return { select: profileSelect, update };
    if (table === 'user_charts') return { upsert: upsertCharts };
    if (table === 'daily_haps') return { delete: deleteFn };
    return {};
  });

  return {
    auth: { getUser },
    from,
    _profileSelect: profileSelect,
    _update: update,
    _updateEq: updateEq,
    _upsertCharts: upsertCharts,
    _delete: deleteFn,
    _deleteEq1: deleteEq1,
    _deleteEq2: deleteEq2,
  };
}

function makePatchRequest(body: unknown) {
  return new Request('http://localhost/api/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(computeChart).mockResolvedValue({ chart_core: MOCK_CHART_CORE, chart_hash: MOCK_CHART_HASH });
});

// ─── GET /api/me ───────────────────────────────────────────────────────────

describe('GET /api/me', () => {
  it('200 → profile 필드 반환', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient({}) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.profile.nickname).toBe('하늘달');
    expect(body.profile.birth_date).toBe('1991-03-15');
  });

  it('401 → UNAUTHORIZED (미인증)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient({ userId: null }) as never);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('404 → NOT_ONBOARDED (users row 없음)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ profileRow: null }) as never,
    );
    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_ONBOARDED');
  });
});

// ─── PATCH /api/me ─────────────────────────────────────────────────────────

describe('PATCH /api/me', () => {
  it('401 → UNAUTHORIZED (미인증)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient({ userId: null }) as never);
    const res = await PATCH(makePatchRequest(VALID_UPDATE_BODY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('400 → INVALID_BODY (nickname 없음)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeClient({}) as never);
    const bad = structuredClone(VALID_UPDATE_BODY) as Record<string, unknown>;
    delete bad.nickname;
    const res = await PATCH(makePatchRequest(bad));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('404 → NOT_ONBOARDED (users row 없음)', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeClient({ profileRow: null }) as never,
    );
    const res = await PATCH(makePatchRequest(VALID_UPDATE_BODY));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_ONBOARDED');
  });

  it('200 → users UPDATE + user_charts upsert + daily_haps DELETE 호출', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const res = await PATCH(makePatchRequest(VALID_UPDATE_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(client._update).toHaveBeenCalledOnce();
    expect(client._upsertCharts).toHaveBeenCalledOnce();
    expect(client._delete).toHaveBeenCalledOnce();
  });

  it('500 → computeChart 실패 시 users UPDATE 미호출', async () => {
    vi.mocked(computeChart).mockRejectedValue(new Error('KASI timeout'));
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const res = await PATCH(makePatchRequest(VALID_UPDATE_BODY));
    expect(res.status).toBe(500);
    expect(client._update).not.toHaveBeenCalled();
  });

  it('200 → users UPDATE 시 nickname, birth_date 포함 (consented_tos_version 제외)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    await PATCH(makePatchRequest(VALID_UPDATE_BODY));
    const updated = client._update.mock.calls[0][0] as Record<string, unknown>;
    expect(updated.nickname).toBe('하늘달');
    expect(updated.birth_date).toBe('1991-03-15');
    expect(updated.consented_tos_version).toBeUndefined();
  });

  it('500 → users UPDATE 실패 시 INTERNAL_ERROR', async () => {
    const client = makeClient({ updateError: { code: 'PGRST000', message: 'DB down' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const res = await PATCH(makePatchRequest(VALID_UPDATE_BODY));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('200 → daily_haps DELETE 시 오늘 날짜(2026-05-14) + user_id 사용', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    await PATCH(makePatchRequest(VALID_UPDATE_BODY));
    // first eq('user_id', ...)
    expect(client._deleteEq1).toHaveBeenCalledWith('user_id', 'user-uuid-001');
    // second eq('target_date', todayKST())
    expect(client._deleteEq2).toHaveBeenCalledWith('target_date', '2026-05-14');
  });
});
