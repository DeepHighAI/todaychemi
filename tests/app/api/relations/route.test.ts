import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/chart/compute');
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
// 슬롯 게이트는 라우트 단에서 mock — 게이트 내부는 feature-gate 자체 테스트가 커버.
vi.mock('@/lib/payments/feature-gate');
vi.mock('@/lib/relations/materialize');
// 무료 경로는 원자 RPC 헬퍼로 위임 — 내부는 insert.test 가 커버, 여기선 분기만 검증.
vi.mock('@/lib/relations/insert');

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { computeChart } from '@/lib/chart/compute';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { materializeRelationSlot } from '@/lib/relations/materialize';
import { insertFreeRelationIfUnderCap } from '@/lib/relations/insert';
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
  pendingsError?: { code: string; message: string } | null;
  stagedPendingId?: string;
  stageError?: { code: string; message: string } | null;
  refundError?: { message: string } | null;
  openPendingCount?: number;
  openPendingError?: { code: string; message: string } | null;
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
  const pendingsResult = { data: opts.pendings ?? [], error: opts.pendingsError ?? null };
  const pendingSelChain: Record<string, unknown> = {};
  pendingSelChain.eq = vi.fn(() => pendingSelChain);
  pendingSelChain.in = vi.fn(() => pendingSelChain);
  pendingSelChain.is = vi.fn(() => pendingSelChain);
  pendingSelChain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(pendingsResult).then(res, rej);
  // open-pending 캡 count 쿼리: .select(col,{head:true}).eq().is() → {count}
  const openPendingChain: Record<string, unknown> = {};
  openPendingChain.eq = vi.fn(() => openPendingChain);
  openPendingChain.is = vi.fn(() => openPendingChain);
  openPendingChain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve({
      count: opts.openPendingError ? null : (opts.openPendingCount ?? 0),
      error: opts.openPendingError ?? null,
    }).then(res, rej);
  const pendingFrom = {
    insert: pendingInsert,
    select: vi.fn((_col: string, selOpts?: { head?: boolean }) =>
      selOpts?.head ? openPendingChain : pendingSelChain,
    ),
  };

  const from = vi.fn((table: string) => {
    if (table === 'payments') return paymentsChain;
    if (table === 'pending_relation_registrations') return pendingFrom;
    return { select: vi.fn() };
  });

  return {
    service: { from, rpc } as never,
    rpc,
    from,
    _pendingInsert: pendingInsert,
    _pendingSelIs: pendingSelChain.is as ReturnType<typeof vi.fn>,
  };
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
  // 기본: 무료 슬롯 여유 → 원자 RPC 가 relation_id 반환(무료 등록 성공).
  // 유료 경로 테스트는 각자 mockResolvedValue(null)(슬롯 초과)로 덮어쓴다.
  vi.mocked(insertFreeRelationIfUnderCap).mockResolvedValue('rel-free-001');
});

describe('POST /api/relations — 무료 경로 (원자 RPC 분기)', () => {
  it('200 → 무료 슬롯 여유(RPC relation_id) → 등록 성공, 머티리얼라이즈 미호출', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.relation_id).toBe('rel-free-001');
    // 원자 RPC 에 인증 user.id + draft + FREE_RELATION_SLOTS(2) 전달
    expect(insertFreeRelationIfUnderCap).toHaveBeenCalledWith(
      expect.anything(),
      'user-uuid-001',
      expect.objectContaining({ nickname: '봄달', mode: '친구합' }),
      2,
    );
    expect(materializeRelationSlot).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY (nickname 없음) — RPC 미호출', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const bad = structuredClone(VALID_BODY);
    delete (bad as any).nickname;
    const res = await POST(makeRequest(bad));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_BODY');
    expect(insertFreeRelationIfUnderCap).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY (mode 외래값)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({ ...VALID_BODY, mode: '사랑합' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_BODY');
  });

  it('400 → INVALID_BODY (birth_place 추가 필드 — PII strict 가드)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({ ...VALID_BODY, birth_place: '서울' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_BODY');
  });

  it('400 → INVALID_BODY (unknown 시간인데 birth_time 이 남아 있음) — RPC 미호출', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({
      ...VALID_BODY,
      birth_time_knowledge: 'unknown',
      birth_time: '09:00',
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_BODY');
    expect(insertFreeRelationIfUnderCap).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY (exact 시간인데 birth_time 이 null) — RPC 미호출', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({
      ...VALID_BODY,
      birth_time_knowledge: 'exact',
      birth_time: null,
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_BODY');
    expect(insertFreeRelationIfUnderCap).not.toHaveBeenCalled();
  });

  it('400 → INVALID_BODY (solar 날짜에 lunar leap flag true) — RPC 미호출', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest({
      ...VALID_BODY,
      birth_date_calendar: 'solar',
      is_lunar_leap: true,
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_BODY');
    expect(insertFreeRelationIfUnderCap).not.toHaveBeenCalled();
  });

  it('401 → UNAUTHORIZED (미인증) — RPC 미호출', async () => {
    const client = makeClient({ userId: null });
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
    expect(insertFreeRelationIfUnderCap).not.toHaveBeenCalled();
  });

  it('500 → INTERNAL_ERROR (무료 RPC throw)', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    vi.mocked(insertFreeRelationIfUnderCap).mockRejectedValue(new Error('rpc down'));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL_ERROR');
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
    expect((await res.json()).error.code).toBe('INVALID_BODY');
  });
});

describe('POST /api/relations — 슬롯 게이트 (ADR-039 Amended)', () => {
  // 유료 경로 전제: 원자 RPC 가 null(무료 슬롯 초과) 반환 → handlePaidSlot 진입.
  beforeEach(() => {
    vi.mocked(insertFreeRelationIfUnderCap).mockResolvedValue(null);
  });

  it('슬롯 초과(RPC null) → draft 를 pending 에 스테이징하고 relation_slot ref 로 게이트 호출', async () => {
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
    // pending 조회는 paid ref 의 pending_id 로 IN 필터되므로 결과는 paid 고아만 — 미결제는 애초에 안 옴
    const svc = makeService({
      stagedPendingId: 'pend-new-001',
      paidRefs: ['relation_slot:pend-orphan-7'],
      pendings: [{ pending_id: 'pend-orphan-7' }],
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    const res = await POST(makeRequest(VALID_BODY));

    // 고아(confirmed 결제 보유)만 머티리얼라이즈
    expect(materializeRelationSlot).toHaveBeenCalledWith(
      expect.anything(),
      'user-uuid-001',
      'pend-orphan-7',
    );
    // 복구 후 신규 draft 는 자기 흐름대로 402
    expect(res.status).toBe(402);
  });

  it('A1 복구: 한 고아 머티리얼라이즈 실패가 다른 고아 복구를 막지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({
      stagedPendingId: 'pend-new-001',
      paidRefs: ['relation_slot:pend-a', 'relation_slot:pend-b'],
      pendings: [{ pending_id: 'pend-a' }, { pending_id: 'pend-b' }],
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);
    vi.mocked(materializeRelationSlot)
      .mockRejectedValueOnce(new Error('pend-a boom'))
      .mockResolvedValueOnce('rel-b');

    const res = await POST(makeRequest(VALID_BODY));

    // 두 고아 모두 시도 — 첫 실패가 둘째를 막지 않음
    expect(materializeRelationSlot).toHaveBeenCalledWith(expect.anything(), 'user-uuid-001', 'pend-a');
    expect(materializeRelationSlot).toHaveBeenCalledWith(expect.anything(), 'user-uuid-001', 'pend-b');
    expect(consoleSpy).toHaveBeenCalledWith('relation_slot_recovery_item_failed', expect.anything());
    expect(res.status).toBe(402);
    consoleSpy.mockRestore();
  });

  it('A1 복구는 무료 구간에서도 실행 — 인연 삭제로 내려가도 paid 고아 전달', async () => {
    const client = makeClient({});
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({
      paidRefs: ['relation_slot:pend-orphan-7'],
      pendings: [{ pending_id: 'pend-orphan-7' }],
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);
    // 무료 슬롯 여유 → 현재 draft 는 무료 RPC 로 등록되지만, recoverPaidPendings 는 그 전에 실행
    vi.mocked(insertFreeRelationIfUnderCap).mockResolvedValue('rel-free-001');

    const res = await POST(makeRequest(VALID_BODY));

    // recoverPaidPendings 가 무료/유료 분기 전에 실행 → paid 고아 전달
    expect(materializeRelationSlot).toHaveBeenCalledWith(
      expect.anything(),
      'user-uuid-001',
      'pend-orphan-7',
    );
    // 현재 draft 는 무료 경로로 정상 등록
    expect(res.status).toBe(200);
  });

  it('A1 복구 중 pending 조회 실패 → relation_slot_recovery_failed 로깅 후 신규 등록 흐름 계속', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    // payments 조회는 성공하나 pending 조회가 실패 → outer catch
    const svc = makeService({
      stagedPendingId: 'pend-new-001',
      paidRefs: ['relation_slot:pend-orphan-7'],
      pendingsError: { code: 'PGRST000', message: 'pending query down' },
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    const res = await POST(makeRequest(VALID_BODY));

    expect(consoleSpy).toHaveBeenCalledWith(
      'relation_slot_recovery_failed',
      expect.objectContaining({ user_id: 'user-uuid-001' }),
    );
    expect(res.status).toBe(402);
    consoleSpy.mockRestore();
  });

  it('A1 복구 조회는 delivered_at IS NULL 필터 — 클레임만 되고 죽은(materialized_at 有) paid 고아도 포함', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({
      stagedPendingId: 'pend-new-001',
      paidRefs: ['relation_slot:pend-stuck-01'],
      pendings: [{ pending_id: 'pend-stuck-01' }],
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    await POST(makeRequest(VALID_BODY));

    // 미전달 판별의 단일 진실은 delivered_at (materialized_at 은 클레임 마커일 뿐 — feb93af 상태머신)
    expect(svc._pendingSelIs).toHaveBeenCalledWith('delivered_at', null);
    expect(svc._pendingSelIs).not.toHaveBeenCalledWith('materialized_at', null);
    expect(materializeRelationSlot).toHaveBeenCalledWith(expect.anything(), 'user-uuid-001', 'pend-stuck-01');
  });

  it('open-pending 캡 count 조회 실패 → 500 fail-closed, 스테이징 안 함', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ openPendingError: { code: 'PGRST000', message: 'count down' } });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(svc._pendingInsert).not.toHaveBeenCalled();
    expect(resolveFeatureCharge).not.toHaveBeenCalled();
  });

  it('open-pending 캡: 미머티리얼라이즈 pending ≥10 → 429 RATE_LIMITED, 스테이징 안 함', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ openPendingCount: 10 });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(svc._pendingInsert).not.toHaveBeenCalled();
    expect(resolveFeatureCharge).not.toHaveBeenCalled();
  });

  it('open-pending 캡 미만(9) → 정상 스테이징 진행', async () => {
    const client = makeClient({ relationCount: 2 });
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const svc = makeService({ openPendingCount: 9, stagedPendingId: 'pend-new-001' });
    vi.mocked(createServiceRoleClient).mockReturnValue(svc.service);

    const res = await POST(makeRequest(VALID_BODY));

    // 잔액 부족 기본 mock → 402 (캡 통과 증거)
    expect(res.status).toBe(402);
    expect(svc._pendingInsert).toHaveBeenCalledOnce();
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
