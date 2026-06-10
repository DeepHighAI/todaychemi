import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/chart/compute');
// 슬롯 게이트는 라우트 단에서 mock — 게이트 내부는 feature-gate 자체 테스트가 커버.
vi.mock('@/lib/payments/feature-gate');
vi.mock('@/lib/relations/materialize');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { computeChart } from '@/lib/chart/compute';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { materializeRelationSlot } from '@/lib/relations/materialize';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { GET, POST } from '@/app/api/relations/route';
import type { ChartCore } from '@/types/chart';

const VALID_BODY = {
  nickname: '봄달',
  mode: '친구합',
  gender: 'F',
  birth_date: '1995-07-20',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '09:00',
  birth_longitude: null,
  consent_confirmed: true,
  is_primary: false,
};

const MOCK_CHART_CORE: ChartCore = {
  year_pillar: '辛未', month_pillar: '癸卯', day_pillar: '甲戌', hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};
const MOCK_CHART_HASH = 'b'.repeat(64);

function makeClient(opts: {
  userId?: string | null;
  insertError?: { code: string; message: string } | null;
  insertedRows?: Array<{ relation_id?: string }> | null;
  upsertChartError?: { code: string; message: string } | null;
  selectRows?: unknown[] | null;
  selectError?: { code: string; message: string } | null;
  relationCount?: number;
  countError?: { code: string; message: string } | null;
}) {
  const userId = opts.userId === undefined ? 'user-uuid-001' : opts.userId;

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });

  const upsertCharts = vi.fn().mockResolvedValue({
    data: null,
    error: opts.upsertChartError ?? null,
  });

  const limit = vi.fn().mockResolvedValue({
    data: opts.selectRows ?? [],
    error: opts.selectError ?? null,
  });
  const order = vi.fn().mockReturnValue({ limit });
  // 슬롯 게이트 count 조회(head:true) 와 GET 목록 조회를 분기
  const countEq = vi.fn().mockResolvedValue({
    count: opts.relationCount ?? 0,
    error: opts.countError ?? null,
  });
  const select = vi.fn().mockImplementation((_sel: string, selOpts?: { head?: boolean }) => {
    if (selOpts?.head) return { eq: countEq };
    return { order };
  });

  // relations INSERT chains .select('relation_id') → returns {data, error}
  const selectAfterInsert = vi.fn().mockResolvedValue({
    data: opts.insertError ? null : (opts.insertedRows ?? [{ relation_id: 'rel-uuid-001' }]),
    error: opts.insertError ?? null,
  });
  const insertRelations = vi.fn().mockReturnValue({ select: selectAfterInsert });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'relations') return { insert: insertRelations, select };
    if (table === 'relation_charts') return { upsert: upsertCharts };
    return { insert: vi.fn(), upsert: vi.fn(), select };
  });

  return { auth: { getUser }, from, _insert: insertRelations, _upsertCharts: upsertCharts, _select: select, _order: order, _limit: limit, _countEq: countEq };
}

// service-role mock — 유료 슬롯 경로(payments 복구 조회 + pending 스테이징 + refund rpc)
function makeService(opts: {
  paidRefs?: string[];
  pendings?: Array<{ pending_id: string }>;
  stagedPendingId?: string;
  stageError?: { code: string; message: string } | null;
  refundError?: { message: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: opts.refundError ?? null });

  // payments 복구 조회: .select().eq()×4 → await (thenable)
  const paymentsResult = {
    data: (opts.paidRefs ?? []).map((feature_ref) => ({ feature_ref })),
    error: null,
  };
  const paymentsChain: Record<string, unknown> = {};
  paymentsChain.select = vi.fn(() => paymentsChain);
  paymentsChain.eq = vi.fn(() => paymentsChain);
  paymentsChain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(paymentsResult).then(res, rej);

  // pending: 스테이징 insert(.insert().select() → await) + 복구 select(.select().eq().is() → await)
  const insertSelect = vi.fn().mockResolvedValue({
    data: opts.stageError ? null : [{ pending_id: opts.stagedPendingId ?? 'pend-new-001' }],
    error: opts.stageError ?? null,
  });
  const pendingInsert = vi.fn((_payload: unknown) => ({ select: insertSelect }));
  const pendingsResult = { data: opts.pendings ?? [], error: null };
  const pendingSelChain: Record<string, unknown> = {};
  pendingSelChain.eq = vi.fn(() => pendingSelChain);
  pendingSelChain.is = vi.fn(() => pendingSelChain);
  pendingSelChain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(pendingsResult).then(res, rej);
  const pendingFrom = {
    insert: pendingInsert,
    select: vi.fn(() => pendingSelChain),
  };

  const from = vi.fn((table: string) => {
    if (table === 'payments') return paymentsChain;
    if (table === 'pending_relation_registrations') return pendingFrom;
    return { select: vi.fn() };
  });

  return { service: { from, rpc } as never, rpc, from, _pendingInsert: pendingInsert };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/relations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(computeChart).mockResolvedValue({ chart_core: MOCK_CHART_CORE, chart_hash: MOCK_CHART_HASH });
  vi.mocked(createServiceRoleClient).mockReturnValue(makeService().service);
  vi.mocked(resolveFeatureCharge).mockResolvedValue({
    mode: 'pay_required',
    price: FEATURE_PRICES_KRW.relation_slot,
    charged: false,
  });
  vi.mocked(materializeRelationSlot).mockResolvedValue('rel-paid-001');
});

describe('POST /api/relations', () => {
  it('200 → relations INSERT 성공 (정상 경로)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(client._insert).toHaveBeenCalledOnce();
  });

  it('INSERT body 에 user_id, nickname, mode, birth_date, gender, consent_confirmed 전달됨', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    await POST(makeRequest(VALID_BODY));

    const inserted = client._insert.mock.calls[0][0];
    expect(inserted.user_id).toBe('user-uuid-001');
    expect(inserted.nickname).toBe('봄달');
    expect(inserted.mode).toBe('친구합');
    expect(inserted.birth_date).toBe('1995-07-20');
    expect(inserted.gender).toBe('F');
    expect(inserted.birth_time_knowledge).toBe('exact');
    expect(inserted.consent_confirmed).toBe(true);
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

  it('400 → INVALID_BODY (mode 외래값)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({ ...VALID_BODY, mode: '사랑합' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('400 → INVALID_BODY (birth_place 추가 필드 — PII strict 가드)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({ ...VALID_BODY, birth_place: '서울' }));

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
      birth_time: '09:00',
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

  it('500 → INTERNAL_ERROR (generic DB failure)', async () => {
    const client = makeClient({ insertError: { code: 'PGRST000', message: 'DB down' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('500 → INSERT 성공처럼 보이나 relation_id row가 없으면 chart compute 없이 실패', async () => {
    const client = makeClient({ insertedRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(computeChart).not.toHaveBeenCalled();
    expect(client._upsertCharts).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY on non-JSON body', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(
      new Request('http://localhost/api/relations', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not json',
      }) as unknown as Parameters<typeof POST>[0],
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('200 성공 시 relation_charts upsert 호출 (chart_hash, chart_core, user_id, relation_id)', async () => {
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

  it('computeChart 실패 → 200 (relation 등록 완료, chartPending UX)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(computeChart).mockRejectedValue(
      new Error('KASI timeout birth_date=1995-07-20 birth_time=09:00 gender=F'),
    );
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    // relation은 등록됨 (chartPending은 기존 UX), chart upsert는 skip
    expect(res.status).toBe(200);
    expect(client._insert).toHaveBeenCalledOnce();
    expect(client._upsertCharts).not.toHaveBeenCalled();
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).not.toContain('1995-07-20');
    expect(logged).not.toContain('09:00');
    expect(logged).not.toContain('gender=F');
    consoleSpy.mockRestore();
  });

  it('relation_charts upsert 실패 → 200 (relation 등록 완료, chartPending UX)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = makeClient({ upsertChartError: { code: 'PGRST000', message: 'upsert fail' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.relation_id).toBe('rel-uuid-001');
    expect(client._insert).toHaveBeenCalledOnce();
    expect(client._upsertCharts).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[relations] relation_charts upsert failed',
      expect.objectContaining({
        error_code: 'PGRST000',
        error: expect.stringContaining('upsert fail'),
      }),
    );
    consoleSpy.mockRestore();
  });
});

describe('POST /api/relations — 슬롯 게이트 (ADR-039 Amended)', () => {
  it('보유 1건(<2) → 무료 등록, 게이트·머티리얼라이즈 미호출', async () => {
    const client = makeClient({ relationCount: 1 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(client._insert).toHaveBeenCalledOnce();
    expect(resolveFeatureCharge).not.toHaveBeenCalled();
    expect(materializeRelationSlot).not.toHaveBeenCalled();
  });

  it('보유 2건(≥2) → draft 를 pending 에 스테이징하고 relation_slot ref 로 게이트 호출', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ stagedPendingId: 'pend-new-001' });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    await POST(makeRequest(VALID_BODY));

    const staged = svc._pendingInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(staged.user_id).toBe('user-uuid-001');
    expect(staged.draft).toMatchObject({ nickname: '봄달', mode: '친구합' });
    expect(resolveFeatureCharge).toHaveBeenCalledWith(
      expect.anything(),
      'user-uuid-001',
      'relation_slot',
      'relation_slot:pend-new-001',
    );
  });

  it('≥2 + 부적 차감 성공(free) → 머티리얼라이즈 후 200, 무료경로 INSERT 미사용', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ stagedPendingId: 'pend-new-001' });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({
      mode: 'free',
      price: FEATURE_PRICES_KRW.relation_slot,
      charged: true,
    });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.relation_id).toBe('rel-paid-001');
    expect(materializeRelationSlot).toHaveBeenCalledWith(
      expect.anything(),
      'user-uuid-001',
      'pend-new-001',
    );
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('≥2 + 잔액 부족(pay_required) → 402 PAYMENT_REQUIRED + ref/amount, 머티리얼라이즈 미호출', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ stagedPendingId: 'pend-new-001' });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('relation_slot');
    expect(body.ref).toBe('relation_slot:pend-new-001');
    expect(body.amount_krw).toBe(1000);
    expect(materializeRelationSlot).not.toHaveBeenCalled();
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('≥2 + 이미 잠금해제(unlocked) → 머티리얼라이즈 후 200', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ stagedPendingId: 'pend-new-001' });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({
      mode: 'unlocked',
      price: FEATURE_PRICES_KRW.relation_slot,
      charged: false,
    });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(materializeRelationSlot).toHaveBeenCalledOnce();
  });

  it('free 차감 후 머티리얼라이즈 실패 → refund_tokens_once(+10) 환불 + 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ stagedPendingId: 'pend-new-001' });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({
      mode: 'free',
      price: FEATURE_PRICES_KRW.relation_slot,
      charged: true,
    });
    vi.mocked(materializeRelationSlot).mockRejectedValue(new Error('insert blew up'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(svc.rpc).toHaveBeenCalledWith('refund_tokens_once', {
      uid: 'user-uuid-001',
      delta: 10,
      reason: 'relation_slot_refund',
      ref: 'relation_slot:pend-new-001',
    });
    consoleSpy.mockRestore();
  });

  it('환불마저 실패 → relation_slot_refund_failed 로깅 (silent token loss 방지)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({
      stagedPendingId: 'pend-new-001',
      refundError: { message: 'refund rpc down' },
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);
    vi.mocked(resolveFeatureCharge).mockResolvedValue({
      mode: 'free',
      price: FEATURE_PRICES_KRW.relation_slot,
      charged: true,
    });
    vi.mocked(materializeRelationSlot).mockRejectedValue(new Error('insert blew up'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      'relation_slot_refund_failed',
      expect.objectContaining({ user_id: 'user-uuid-001', pending_id: 'pend-new-001' }),
    );
    consoleSpy.mockRestore();
  });

  it('charged=false(pay_required 전 throw 등) 실패 → 환불 rpc 미호출', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ stagedPendingId: 'pend-new-001' });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);
    vi.mocked(resolveFeatureCharge).mockRejectedValue(new Error('rpc deadlock'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(svc.rpc).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('A1 lazy recovery: 결제 confirmed + 미머티리얼라이즈 pending 을 새 스테이징 전에 전달', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({
      stagedPendingId: 'pend-new-001',
      paidRefs: ['relation_slot:pend-orphan-7'],
      pendings: [{ pending_id: 'pend-orphan-7' }, { pending_id: 'pend-unpaid-8' }],
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    const res = await POST(makeRequest(VALID_BODY));

    // 고아(confirmed 결제 보유)만 머티리얼라이즈 — 미결제 pending 은 건드리지 않는다
    expect(materializeRelationSlot).toHaveBeenCalledWith(
      expect.anything(),
      'user-uuid-001',
      'pend-orphan-7',
    );
    expect(materializeRelationSlot).not.toHaveBeenCalledWith(
      expect.anything(),
      'user-uuid-001',
      'pend-unpaid-8',
    );
    // 복구 후 신규 draft 는 자기 흐름대로 402
    expect(res.status).toBe(402);
  });

  it('A1 복구 실패 → relation_slot_recovery_failed 로깅 후 신규 등록 흐름 계속', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({
      stagedPendingId: 'pend-new-001',
      paidRefs: ['relation_slot:pend-orphan-7'],
      pendings: [{ pending_id: 'pend-orphan-7' }],
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);
    vi.mocked(materializeRelationSlot).mockRejectedValue(new Error('recovery boom'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(consoleSpy).toHaveBeenCalledWith(
      'relation_slot_recovery_failed',
      expect.objectContaining({ user_id: 'user-uuid-001' }),
    );
    expect(res.status).toBe(402);
    consoleSpy.mockRestore();
  });

  it('pending 스테이징 실패 → 500', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ stageError: { code: 'PGRST000', message: 'insert fail' } });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(resolveFeatureCharge).not.toHaveBeenCalled();
  });

  it('count 조회 실패 → 500 (게이트 판정 불가 시 등록 금지)', async () => {
    const client = makeClient({ countError: { code: 'PGRST000', message: 'count fail' } });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(client._insert).not.toHaveBeenCalled();
  });

  it('real-gate 통합: 미잠금 + 부적 부족 → 402 end-to-end (게이트 mock 미사용)', async () => {
    const realGate = (await vi.importActual('@/lib/payments/feature-gate')) as {
      resolveFeatureCharge: typeof resolveFeatureCharge;
    };
    vi.mocked(resolveFeatureCharge).mockImplementation(realGate.resolveFeatureCharge);

    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    // 최소 from-chain: 미잠금(token_ledger/payments miss) + 스테이징 + deduct rpc 잔액부족
    const insertSelect = vi.fn().mockResolvedValue({
      data: [{ pending_id: 'pend-real-1' }],
      error: null,
    });
    const leaf = { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.insert = vi.fn(() => ({ select: insertSelect }));
    chain.limit = vi.fn(() => leaf);
    chain.maybeSingle = leaf.maybeSingle;
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(res, rej);
    const localService = {
      from: vi.fn(() => chain),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'INSUFFICIENT_TOKENS', code: 'P0001' },
      }),
    };
    vi.mocked(createServiceRoleClient).mockReturnValue(localService as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.feature).toBe('relation_slot');
    expect(localService.rpc).toHaveBeenCalledWith(
      'deduct_tokens_once',
      expect.objectContaining({ reason: 'relation_slot_use', delta: -10 }),
    );
  });
});

describe('GET /api/relations', () => {
  it('200 → relations 목록 반환 (FeedListItem subset)', async () => {
    const rows = [
      { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      { relation_id: 'r2', nickname: '여름새', mode: '오래합', created_at: '2026-05-04T08:00:00Z' },
    ];
    const client = makeClient({ selectRows: rows });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].relation_id).toBe('r1');
    expect(body.items[0].nickname).toBe('봄달');
    expect(body.items[0].mode).toBe('친구합');
  });

  it('200 → 빈 목록 (relation 0건)', async () => {
    const client = makeClient({ selectRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('GET 은 created_at 기준 내림차순 정렬을 요청한다', async () => {
    const client = makeClient({ selectRows: [] });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    await GET();

    expect(client._order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(client._limit).toHaveBeenCalledWith(200);
  });

  it('401 → UNAUTHORIZED (미인증)', async () => {
    const client = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(client._select).not.toHaveBeenCalled();
  });

  it('500 → INTERNAL_ERROR (DB select 실패)', async () => {
    const client = makeClient({
      selectError: { code: 'PGRST000', message: 'DB down' },
    });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
