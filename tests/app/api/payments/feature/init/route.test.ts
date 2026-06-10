import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/payments/feature-ref-ownership');

import { POST } from '@/app/api/payments/feature/init/route';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { verifyFeatureRefOwnership } from '@/lib/payments/feature-ref-ownership';

const USER_ID = 'user-feat-001';
const REF = 'cache-key-abc';

function makeServerClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

// from('payments') 는 기존 주문 조회(select.eq.eq.eq.in.maybeSingle)와 신규 insert(insert.select.single)를 모두 지원.
// existingSecond 가 주어지면 1차 lookup→existing, 2차 lookup(23505 재조회)→existingSecond 로 분기.
function makeServiceClient(
  opts: { existing?: unknown; existingSecond?: unknown; insertError?: { code: string } } = {},
) {
  const maybeSingle = vi.fn();
  if (opts.existingSecond !== undefined) {
    maybeSingle
      .mockResolvedValueOnce({ data: opts.existing ?? null, error: null })
      .mockResolvedValueOnce({ data: opts.existingSecond, error: null });
  } else {
    maybeSingle.mockResolvedValue({ data: opts.existing ?? null, error: null });
  }
  const selIn = vi.fn().mockReturnValue({ maybeSingle });
  const selEq3 = vi.fn().mockReturnValue({ in: selIn });
  const selEq2 = vi.fn().mockReturnValue({ eq: selEq3 });
  const selEq1 = vi.fn().mockReturnValue({ eq: selEq2 });
  const select = vi.fn().mockReturnValue({ eq: selEq1 });

  const insertSingle = vi.fn().mockResolvedValue(
    opts.insertError
      ? { data: null, error: opts.insertError }
      : {
          data: {
            payment_id: 'payment-feat-001',
            toss_order_id: 'twoday_1_abcdef',
            toss_customer_key: 'customer_x',
            status: 'pending',
          },
          error: null,
        },
  );
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });

  const from = vi.fn().mockReturnValue({ select, insert });
  return { client: { from } as never, from, insert };
}

function request(body: unknown) {
  return new Request('http://localhost/api/payments/feature/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TOSS_CLIENT_KEY', 'test_gck_abc');
  vi.stubEnv('TOSS_SECRET_KEY', 'test_gsk_abc');
  // 기본: 사용자가 ref 의 선생성 결과를 소유 (codex #4). 미소유 케이스만 개별 override.
  vi.mocked(verifyFeatureRefOwnership).mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/payments/feature/init', () => {
  it('신규 주문 — 서버 가격으로 pending feature_use 주문 생성(201)', async () => {
    const service = makeServiceClient();
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);

    const res = await POST(request({ feature: 'hapcard', ref: REF }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(service.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        charge_type: 'feature_use',
        feature_id: 'hapcard',
        feature_ref: REF,
        amount_krw: 1000,
        token_amount: null,
        product_id: null,
        status: 'pending',
      }),
    );
    expect(body.unlocked).toBe(false);
    expect(body.payment.amount_krw).toBe(1000);
    expect(body.payment.order_name).toBe('케미카드 보기');
    expect(body.payment.client_key).toBe('test_gck_abc');
    expect(body.payment.order_id).toBe('twoday_1_abcdef');
  });

  it('relation_slot 신규 주문 — 인연 등록 1,000원 pending 주문 생성(201)', async () => {
    const service = makeServiceClient();
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);

    const res = await POST(request({ feature: 'relation_slot', ref: 'relation_slot:pend-1' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(service.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        charge_type: 'feature_use',
        feature_id: 'relation_slot',
        feature_ref: 'relation_slot:pend-1',
        amount_krw: 1000,
        token_amount: null,
        status: 'pending',
      }),
    );
    expect(body.payment.order_name).toBe('인연 등록');
  });

  it('클라이언트가 보낸 가격 필드는 무시(서버 신뢰)', async () => {
    const service = makeServiceClient();
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);

    await POST(request({ feature: 'whatif', ref: REF, amount_krw: 1 }));

    expect(service.insert).toHaveBeenCalledWith(
      expect.objectContaining({ feature_id: 'whatif', amount_krw: 800 }),
    );
  });

  it('이미 확정결제 존재 → unlocked:true 단락, insert 안 함', async () => {
    const service = makeServiceClient({ existing: { status: 'confirmed', toss_order_id: 'twoday_old' } });
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);

    const res = await POST(request({ feature: 'hapcard', ref: REF }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unlocked).toBe(true);
    expect(service.insert).not.toHaveBeenCalled();
  });

  it('미결제 pending 존재 → 기존 주문 재사용, insert 안 함', async () => {
    const service = makeServiceClient({
      existing: { status: 'pending', toss_order_id: 'twoday_old', toss_customer_key: 'customer_old' },
    });
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);

    const res = await POST(request({ feature: 'hapcard', ref: REF }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.unlocked).toBe(false);
    expect(body.payment.order_id).toBe('twoday_old');
    expect(body.payment.customer_key).toBe('customer_old');
    expect(service.insert).not.toHaveBeenCalled();
  });

  it('알 수 없는 feature → 400', async () => {
    const service = makeServiceClient();
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);

    const res = await POST(request({ feature: 'tokens_10', ref: REF }));
    expect(res.status).toBe(400);
  });

  it('미인증 → 401', async () => {
    const service = makeServiceClient();
    vi.mocked(createClient).mockResolvedValue(makeServerClient(null) as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);

    const res = await POST(request({ feature: 'hapcard', ref: REF }));
    expect(res.status).toBe(401);
  });

  it('프로덕션 Toss client key 누락 → 503 PAYMENT_CONFIG_MISSING, 주문 생성 안 함', async () => {
    vi.stubEnv('TOSS_CLIENT_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', '');
    vi.stubEnv('TOSS_PAYMENTS_CLIENT_KEY', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);

    const res = await POST(request({ feature: 'hapcard', ref: REF }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe('PAYMENT_CONFIG_MISSING');
    expect(body.error.message).toBe('payment provider is not configured');
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(verifyFeatureRefOwnership).not.toHaveBeenCalled();
  });

  it('프로덕션 Toss secret key 누락 → 503 PAYMENT_CONFIG_MISSING, 주문 생성 안 함', async () => {
    vi.stubEnv('TOSS_CLIENT_KEY', 'live_gck_abc');
    vi.stubEnv('TOSS_SECRET_KEY', '');
    vi.stubEnv('TOSS_PAYMENTS_SECRET_KEY', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);

    const res = await POST(request({ feature: 'hapcard', ref: REF }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe('PAYMENT_CONFIG_MISSING');
    expect(body.error.message).toBe('payment provider is not configured');
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(verifyFeatureRefOwnership).not.toHaveBeenCalled();
  });

  it('ref 미소유(선생성 결과 없음) → 404 PAYMENT_REF_NOT_FOUND, insert 안 함 (codex #4)', async () => {
    const service = makeServiceClient();
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);
    vi.mocked(verifyFeatureRefOwnership).mockResolvedValue(false);

    const res = await POST(request({ feature: 'hapcard', ref: REF }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('PAYMENT_REF_NOT_FOUND');
    expect(verifyFeatureRefOwnership).toHaveBeenCalledWith(service.client, USER_ID, 'hapcard', REF);
    expect(service.insert).not.toHaveBeenCalled();
  });

  it('동시 더블탭 insert 23505 → 기존 pending 재조회·재사용(201), 500 아님 (codex #7)', async () => {
    const service = makeServiceClient({
      existing: null,
      existingSecond: {
        status: 'pending',
        toss_order_id: 'twoday_race',
        toss_customer_key: 'customer_race',
      },
      insertError: { code: '23505' },
    });
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client);

    const res = await POST(request({ feature: 'hapcard', ref: REF }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.unlocked).toBe(false);
    expect(body.payment.order_id).toBe('twoday_race');
    expect(body.payment.customer_key).toBe('customer_race');
    expect(service.insert).toHaveBeenCalledTimes(1);
  });
});
