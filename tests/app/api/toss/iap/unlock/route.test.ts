/**
 * /api/toss/iap/unlock route 단위 테스트.
 *
 * getOrderStatus, supabase server client, service-role client 를 mock.
 * 네트워크 / 인증서 / DB 불필요.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── mock 선언은 import 보다 먼저 ──────────────────────────────────────────────
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@/lib/toss/iap');

import { POST } from '@/app/api/toss/iap/unlock/route';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  getOrderStatus,
  isGrantableStatus,
  resolveFeatureFromSku,
  IapOrderError,
} from '@/lib/toss/iap';
import type { IapOrderStatusSuccess } from '@/lib/toss/iap';

// ---------------------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------------------

const USER_ID = 'user-iap-test-001';
const BEARER_TOKEN = 'supabase-access-token-abc';
const ORDER_ID = 'order-uuid-v7-iap-001';
const REF = 'cache-key-hapcard-xyz';
const SAMPLE_SKU = 'sku_hapcard_001';

const PURCHASED_ORDER: IapOrderStatusSuccess = {
  orderId: ORDER_ID,
  sku: SAMPLE_SKU,
  statusDeterminedAt: '2026-06-14T12:00:00',
  status: 'PURCHASED',
};

// ---------------------------------------------------------------------------
// Supabase 클라이언트 mock 헬퍼
// ---------------------------------------------------------------------------

/** 인증 성공 서버 클라이언트 mock */
function makeAuthClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: userId ? null : { message: 'invalid token' },
      }),
    },
  };
}

/** service-role 클라이언트 insert mock */
function makeServiceClient(opts: {
  insertError?: { code: string; message: string };
  /** 조기 멱등 단락: SELECT.maybeSingle() 이 반환할 값 (null = 기존 row 없음, 기본값) */
  existingRow?: { id: string } | null;
} = {}) {
  const insert = vi.fn().mockResolvedValue({
    error: opts.insertError ?? null,
  });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.existingRow ?? null,
    error: null,
  });
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnValue({ eq, maybeSingle });
  // from('payments') → select 또는 insert
  const from = vi.fn().mockReturnValue({ insert, select, eq, maybeSingle });
  return { client: { from } as never, from, insert, select, maybeSingle };
}

// ---------------------------------------------------------------------------
// 요청 헬퍼
// ---------------------------------------------------------------------------

function makeRequest(
  body: unknown,
  token: string | null = BEARER_TOKEN,
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/toss/iap/unlock', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// 테스트 공통 설정
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // 기본 mock 설정 (각 테스트에서 필요시 재정의)
  vi.mocked(createServerClient).mockResolvedValue(makeAuthClient() as never);

  const { client } = makeServiceClient();
  vi.mocked(createServiceRoleClient).mockReturnValue(client as never);

  // IAP 모듈 기본 mock
  vi.mocked(getOrderStatus).mockResolvedValue(PURCHASED_ORDER);
  vi.mocked(isGrantableStatus).mockReturnValue(true);
  vi.mocked(resolveFeatureFromSku).mockReturnValue('hapcard');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 정상 흐름
// ---------------------------------------------------------------------------

describe('POST /api/toss/iap/unlock — 정상 흐름', () => {
  it('PURCHASED 주문 → 200 { unlocked: true }', async () => {
    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as { unlocked: boolean };
    expect(body.unlocked).toBe(true);
  });

  it('PAYMENT_COMPLETED 주문 → 200 { unlocked: true }', async () => {
    vi.mocked(getOrderStatus).mockResolvedValue({
      ...PURCHASED_ORDER,
      status: 'PAYMENT_COMPLETED',
    });

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as { unlocked: boolean };
    expect(body.unlocked).toBe(true);
  });

  it('payments 행 삽입 시 iap_ 접두어 붙은 toss_order_id 사용', async () => {
    const { client, from, insert } = makeServiceClient();
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never);

    await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(from).toHaveBeenCalledWith('payments');
    const insertArg = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.toss_order_id).toBe(`iap_${ORDER_ID}`);
    expect(insertArg.charge_type).toBe('feature_use');
    expect(insertArg.feature_id).toBe('hapcard');
    expect(insertArg.feature_ref).toBe(REF);
    expect(insertArg.status).toBe('confirmed');
    expect(insertArg.toss_customer_key).toBeNull();
    expect(insertArg.toss_payment_key).toBeNull();
    expect(insertArg.user_id).toBe(USER_ID);
  });
});

// ---------------------------------------------------------------------------
// 멱등성 — 동일 orderId 중복 요청
// ---------------------------------------------------------------------------

describe('POST /api/toss/iap/unlock — 멱등성', () => {
  it('동일 orderId 재요청(23505 충돌) → 200 { unlocked: true } (이중 삽입 없음)', async () => {
    const { client } = makeServiceClient({
      insertError: { code: '23505', message: 'duplicate key value' },
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never);

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as { unlocked: boolean };
    expect(body.unlocked).toBe(true);
  });

  it('restorePendingOrders 복구 경로: 기존 confirmed 행 → 조기 단락 200 (ref 빈 문자열 허용)', async () => {
    // 클라이언트가 feature='hapcard', ref='' 전송 (restore 경로)
    // 서버가 SELECT 에서 기존 confirmed row 발견 → mTLS / SKU 검증 없이 200 반환
    const { client } = makeServiceClient({
      existingRow: { id: 'payments-row-existing-001' },
    });
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never);

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: '',
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as { unlocked: boolean };
    expect(body.unlocked).toBe(true);
    // mTLS 조회 없이 처리됐음을 확인 (getOrderStatus 미호출)
    expect(vi.mocked(getOrderStatus)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SKU ↔ feature 검증
// ---------------------------------------------------------------------------

describe('POST /api/toss/iap/unlock — SKU 검증', () => {
  it('SKU 가 알 수 없는 feature 에 매핑됨 → 400 IAP_SKU_UNKNOWN', async () => {
    vi.mocked(resolveFeatureFromSku).mockReturnValue(null);

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('IAP_SKU_UNKNOWN');
  });

  it('SKU feature 와 요청 feature 불일치 → 400 IAP_SKU_FEATURE_MISMATCH', async () => {
    // SKU 는 'whatif' 에 매핑됐는데 클라이언트는 'hapcard' 를 주장
    vi.mocked(resolveFeatureFromSku).mockReturnValue('whatif');

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('IAP_SKU_FEATURE_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// IAP 상태 검증
// ---------------------------------------------------------------------------

describe('POST /api/toss/iap/unlock — IAP 상태 검증', () => {
  it('REFUNDED 상태 → 402 IAP_ORDER_NOT_GRANTABLE', async () => {
    vi.mocked(getOrderStatus).mockResolvedValue({
      ...PURCHASED_ORDER,
      status: 'REFUNDED',
    });
    vi.mocked(isGrantableStatus).mockReturnValue(false);

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(402);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('IAP_ORDER_NOT_GRANTABLE');
  });

  it('FAILED 상태 → 402 IAP_ORDER_NOT_GRANTABLE', async () => {
    vi.mocked(getOrderStatus).mockResolvedValue({
      ...PURCHASED_ORDER,
      status: 'FAILED',
    });
    vi.mocked(isGrantableStatus).mockReturnValue(false);

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(402);
  });

  it('getOrderStatus IapOrderError → 402 IAP_ORDER_NOT_FOUND', async () => {
    vi.mocked(getOrderStatus).mockRejectedValue(
      new IapOrderError('NOT_FOUND', '주문 없음', ORDER_ID),
    );

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(402);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('IAP_ORDER_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// 인증 실패
// ---------------------------------------------------------------------------

describe('POST /api/toss/iap/unlock — 인증', () => {
  it('Authorization 헤더 없음 → 401 UNAUTHORIZED', async () => {
    const res = await POST(makeRequest(
      { orderId: ORDER_ID, feature: 'hapcard', ref: REF },
      null,  // 헤더 없음
    ));

    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('유효하지 않은 Bearer 토큰 → 401 UNAUTHORIZED', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeAuthClient(null) as never);

    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'hapcard',
      ref: REF,
    }));

    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// Zod 검증 — 400
// ---------------------------------------------------------------------------

describe('POST /api/toss/iap/unlock — 유효성 검증', () => {
  it('orderId 누락 → 400 INVALID_BODY', async () => {
    const res = await POST(makeRequest({ feature: 'hapcard', ref: REF }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('feature 누락 → 400 INVALID_BODY', async () => {
    const res = await POST(makeRequest({ orderId: ORDER_ID, ref: REF }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('ref 필드 누락(undefined) → 400 INVALID_BODY', async () => {
    // ref 필드 자체가 없으면 Zod 가 "Expected string, received undefined" 로 400.
    // 빈 문자열은 restore 경로에서 허용(조기 멱등 단락).
    const res = await POST(makeRequest({ orderId: ORDER_ID, feature: 'hapcard' }));
    expect(res.status).toBe(400);
  });

  it('잘못된 feature 값 → 400 INVALID_BODY', async () => {
    const res = await POST(makeRequest({
      orderId: ORDER_ID,
      feature: 'unknown_feature',
      ref: REF,
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('빈 JSON body → 400 INVALID_BODY', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('4개 feature 값 모두 허용 (whatif/replay/relation_slot)', async () => {
    for (const feature of ['whatif', 'replay', 'relation_slot'] as const) {
      vi.mocked(resolveFeatureFromSku).mockReturnValue(feature);
      const res = await POST(makeRequest({ orderId: ORDER_ID, feature, ref: REF }));
      expect(res.status).toBe(200);
    }
  });
});
