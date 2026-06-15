/**
 * POST /api/toss/iap/unlock
 *
 * Toss IAP 결제 완료 후 피처 잠금해제 엔드포인트.
 *
 * 공유 계약 (클라이언트 ↔ 서버):
 *   요청: { orderId: string, feature: FeatureId, ref: string }
 *   성공: { unlocked: true }
 *   에러: { error: { code, message } }
 *
 * 서버 로직:
 *   1. Zod 검증 + Bearer 토큰으로 사용자 인증 (Supabase getUser)
 *   2. mTLS getOrderStatus → PURCHASED|PAYMENT_COMPLETED 확인
 *   3. SKU ↔ feature 소유 검증 (환경변수 TOSS_IAP_SKU_MAP)
 *   4. payments 행 삽입 — isFeatureUnlocked 이 기존 웹 경로와 동일하게 인식
 *   5. 멱등: 동일 orderId(toss_order_id='iap_{orderId}') → 이미 존재하면 200 재반환
 *
 * ⚠️ mTLS = Node runtime 전용. Edge runtime 금지.
 *
 * 출처: ADR-039(pay-per-use), 구현 레퍼런스 §4.5(order-status), §7.2(payments 재사용)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { FeatureIdSchema, FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { getOrderStatus, resolveFeatureFromSku, isGrantableStatus, IapOrderError } from '@/lib/toss/iap';
import type { MtlsTransport } from '@/types/toss';

// ---------------------------------------------------------------------------
// Node runtime 필수 — mTLS 는 Edge runtime 불가 (§3.3)
// ---------------------------------------------------------------------------
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// 요청 스키마
// ---------------------------------------------------------------------------

const UnlockSchema = z.object({
  /** 토스 IAP SDK 가 반환한 orderId (uuid v7) */
  orderId: z.string().min(1).max(200),
  /** 잠금해제 대상 피처 */
  feature: FeatureIdSchema,
  /**
   * 선생성 결과 캐시 키 또는 참조 문자열.
   * restore 경로(restorePendingOrders)에서는 빈 문자열 허용 — 서버가 orderId 로 기존 row 를 찾아 멱등 처리.
   */
  ref: z.string().max(200),
});

export type IapUnlockRequest = z.infer<typeof UnlockSchema>;

/** 성공 응답 */
export interface IapUnlockResponse {
  unlocked: true;
}

// ---------------------------------------------------------------------------
// 내부 상수
// ---------------------------------------------------------------------------

/** payments.toss_order_id 에 IAP 주문임을 표시하는 접두어 */
const IAP_ORDER_PREFIX = 'iap_';

// ---------------------------------------------------------------------------
// POST 핸들러
// ---------------------------------------------------------------------------

/**
 * transport 파라미터는 테스트 전용 주입 인터페이스.
 * 프로덕션에서는 직접 호출하지 않는다(Next.js 가 POST export 만 호출).
 *
 * @internal transport — 단위테스트에서 mTLS mock 주입
 */
export async function POST(
  request: Request,
  _ctx?: unknown,
  _transport?: MtlsTransport,
): Promise<NextResponse> {
  // ------------------------------------------------------------------
  // 1. Zod 검증
  // ------------------------------------------------------------------
  let body: IapUnlockRequest;
  try {
    const raw = await request.json();
    const parsed = UnlockSchema.safeParse(raw);
    if (!parsed.success) {
      return apiErrorResponse('INVALID_BODY', parsed.error.message, 400);
    }
    body = parsed.data;
  } catch {
    return apiErrorResponse('INVALID_BODY', 'invalid JSON', 400);
  }

  const { orderId, feature, ref } = body;

  // ------------------------------------------------------------------
  // 2. Bearer 인증 — Authorization 헤더 → Supabase user 조회
  // ------------------------------------------------------------------
  const bearerToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearerToken) {
    return apiErrorResponse('UNAUTHORIZED', 'Authorization header required', 401);
  }

  // 미니앱 환경은 쿠키 기반 세션 불가(iOS 서드파티 쿠키 차단, §5.5).
  // Bearer 토큰으로 직접 Supabase getUser 를 호출한다.
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(bearerToken);

  if (authError || !user) {
    return apiErrorResponse('UNAUTHORIZED', 'invalid or expired token', 401);
  }

  // ------------------------------------------------------------------
  // 2.5. 조기 멱등 단락 — 기존 confirmed 행이 있으면 즉시 200 반환
  //       (restorePendingOrders 복구 경로: feature='hapcard', ref='' 전송)
  //       SKU 검증·mTLS 호출 없이 처리 — 이미 서버가 한 번 검증하고 삽입한 행임.
  // ------------------------------------------------------------------
  {
    const svc = createServiceRoleClient();
    const { data: existingRow } = await svc
      .from('payments')
      .select('id')
      .eq('toss_order_id', `${IAP_ORDER_PREFIX}${orderId}`)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (existingRow) {
      const unlocked: IapUnlockResponse = { unlocked: true };
      return NextResponse.json(unlocked, { status: 200 });
    }
  }

  // ------------------------------------------------------------------
  // 3. Toss IAP order-status 조회 (mTLS)
  // ------------------------------------------------------------------
  let orderStatus: Awaited<ReturnType<typeof getOrderStatus>>;
  try {
    orderStatus = await getOrderStatus(orderId, { transport: _transport });
  } catch (err) {
    if (err instanceof IapOrderError) {
      // NOT_FOUND / MINIAPP_MISMATCH / ERROR 등
      return apiErrorResponse(
        'IAP_ORDER_NOT_FOUND',
        `order status check failed: ${err.code}`,
        402,
      );
    }
    throw err;
  }

  // 결제 완료 상태 검증
  if (!isGrantableStatus(orderStatus.status)) {
    // REFUNDED / FAILED / ORDER_IN_PROGRESS 등 — 잠금해제 거부
    return apiErrorResponse(
      'IAP_ORDER_NOT_GRANTABLE',
      `order status is ${orderStatus.status}`,
      402,
    );
  }

  // ------------------------------------------------------------------
  // 4. SKU ↔ feature 소유 검증
  // ------------------------------------------------------------------
  const skuFeature = resolveFeatureFromSku(orderStatus.sku);
  if (!skuFeature) {
    // SKU 매핑 없음 — 콘솔에 등록되지 않은 SKU
    return apiErrorResponse(
      'IAP_SKU_UNKNOWN',
      `sku '${orderStatus.sku}' is not mapped to any feature`,
      400,
    );
  }

  if (skuFeature !== feature) {
    // 클라이언트가 주장한 feature 와 실제 SKU 가 다름 — 위변조 시도 차단
    return apiErrorResponse(
      'IAP_SKU_FEATURE_MISMATCH',
      `sku maps to '${skuFeature}' but request claims '${feature}'`,
      400,
    );
  }

  // ------------------------------------------------------------------
  // 5. payments 행 삽입 (isFeatureUnlocked 이 인식하는 웹 경로와 동일 shape)
  //    toss_order_id = 'iap_{orderId}' (웹 토스페이먼츠 주문 ID 와 네임스페이스 분리)
  //    idempotent: 동일 toss_order_id 가 이미 존재하면 23505 → 200 재반환
  // ------------------------------------------------------------------
  const service = createServiceRoleClient();
  const iapOrderId = `${IAP_ORDER_PREFIX}${orderId}`;
  const price = FEATURE_PRICES_KRW[feature];

  const { error: insertErr } = await service.from('payments').insert({
    user_id: user.id,
    toss_order_id: iapOrderId,
    toss_customer_key: null,
    toss_payment_key: null,
    charge_type: 'feature_use',
    feature_id: feature,
    feature_ref: ref,
    product_id: null,
    amount_krw: price.amount_krw,
    token_amount: null,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      // 멱등: 동일 orderId 로 이미 잠금해제됨 — 성공 재반환
      const unlocked: IapUnlockResponse = { unlocked: true };
      return NextResponse.json(unlocked, { status: 200 });
    }
    return apiErrorResponse('INTERNAL_ERROR', insertErr.message, 500);
  }

  // ------------------------------------------------------------------
  // 6. 성공
  // ------------------------------------------------------------------
  const response: IapUnlockResponse = { unlocked: true };
  return NextResponse.json(response, { status: 200 });
}
