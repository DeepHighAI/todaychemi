/**
 * purchase.ts — Toss IAP 결제 + 서버 unlock 로직
 *
 * 두 가지 진입점:
 *   purchaseFeature({ feature, ref, amountKrw, token })
 *     → IAP.createOneTimePurchaseOrder → processProductGrant → POST /api/toss/iap/unlock
 *     → resolve on grant success, reject on failure
 *
 *   restorePendingOrders(token)
 *     → IAP.getPendingOrders → for each orderId: unlock + completeProductGrant
 *     → best-effort (에러 무시, 개별 실패 시 continue)
 *
 * 서버 계약 (server/miniapp 양쪽 정렬):
 *   POST /api/toss/iap/unlock
 *   Request: { orderId, feature, ref }
 *   Response 200: { unlocked: true }
 *   멱등: 동일 orderId/feature/ref → 항상 200
 *
 * § §4.4 30초 지급 창 준수 — processProductGrant 내 fetch 타임아웃 25s.
 */

import { IAP } from '@apps-in-toss/web-framework';
import { apiFetch } from '@/lib/api/client';
import { resolveIapSku, type IapFeature } from './sku';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface PurchaseFeatureParams {
  feature: IapFeature;
  ref: string;
  amountKrw: number;
  token: string | null;
}

export interface UnlockResponse {
  unlocked: boolean;
}

export class IapSkuNotConfiguredError extends Error {
  readonly code = 'IAP_SKU_NOT_CONFIGURED';
  readonly feature: IapFeature;

  constructor(feature: IapFeature) {
    super(`IAP SKU is not configured for ${feature}`);
    this.name = 'IapSkuNotConfiguredError';
    this.feature = feature;
  }
}

export function isIapSkuNotConfiguredError(error: unknown): error is IapSkuNotConfiguredError {
  return error instanceof IapSkuNotConfiguredError ||
    (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'IAP_SKU_NOT_CONFIGURED'
    );
}

// ---------------------------------------------------------------------------
// 서버 unlock 호출
// ---------------------------------------------------------------------------

/**
 * POST /api/toss/iap/unlock 을 호출해 서버측 feature unlock 을 완료한다.
 * processProductGrant 콜백 내에서 호출 (30초 창 준수).
 */
async function callServerUnlock(
  orderId: string,
  feature: IapFeature,
  ref: string,
  token: string | null,
): Promise<boolean> {
  try {
    const res = await apiFetch<UnlockResponse>('/api/toss/iap/unlock', {
      method: 'POST',
      token,
      body: { orderId, feature, ref },
    });
    return res.unlocked === true;
  } catch {
    // 서버 오류 시 false → SDK 가 환불 안내 페이지를 표시 → getPendingOrders 복구로 재시도
    return false;
  }
}

// ---------------------------------------------------------------------------
// 메인 구매 함수
// ---------------------------------------------------------------------------

/**
 * Toss IAP 시트를 열고, 결제 성공 시 서버 unlock 을 완료한다.
 * 완료되면 resolve, 실패하면 reject.
 */
export function purchaseFeature(params: PurchaseFeatureParams): Promise<void> {
  const { feature, ref, amountKrw: _amountKrw, token } = params;
  const sku = resolveIapSku(feature);

  if (!sku.trim()) {
    return Promise.reject(new IapSkuNotConfiguredError(feature));
  }

  return new Promise<void>((resolve, reject) => {
    // §4.3 createOneTimePurchaseOrder — cleanup 반환
    const cleanup = IAP.createOneTimePurchaseOrder({
      options: {
        sku,
        /**
         * processProductGrant: 결제 성공 후 호출 (30초 창).
         * true 반환 → grant 완료. false → SDK 환불 안내 + getPendingOrders 복구 대상.
         */
        processProductGrant: async ({ orderId }: { orderId: string }): Promise<boolean> => {
          const granted = await callServerUnlock(orderId, feature, ref, token);
          if (granted) {
            resolve();
          }
          return granted;
        },
      },
      onEvent: () => {
        // type: 'success' 이벤트 — processProductGrant 가 성공적으로 완료된 후 발화.
        // resolve 는 processProductGrant 내에서 이미 호출됨 — 중복 호출 무해.
      },
      onError: (error: unknown) => {
        // 결제 취소/네트워크 오류 등 — reject 후 cleanup
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    });

    // pagehide 시 SDK cleanup (§4.3 leak 방지)
    window.addEventListener('pagehide', () => { cleanup?.(); }, { once: true });
  });
}

// ---------------------------------------------------------------------------
// 미결 주문 복구 (앱 마운트 시 best-effort)
// ---------------------------------------------------------------------------

/**
 * 미결 주문(결제 완료 + 미지급)을 복구한다.
 * 앱 마운트 시 1회 호출 — 개별 실패는 무시하고 계속 진행.
 *
 * §4.4 복구 흐름:
 *   1. getPendingOrders → paid-but-not-granted orderId 목록
 *   2. 각 orderId: /api/toss/iap/unlock (feature/ref 미지: 서버 idempotency 로 복구)
 *   3. completeProductGrant
 *
 * 주의: pending 주문의 feature/ref 는 클라이언트에서 복원 불가.
 * 서버는 toss_order_id = 'iap_' + orderId 로 기존 payments row 를 찾아 멱등 처리한다.
 * 서버 unlock 엔드포인트는 기존 row 발견 시 feature/ref 무시하고 200 반환(idempotent).
 * 미발견(고아 주문) 시 오류 → catch 에서 skip (completeProductGrant 미호출).
 *
 * 서버 구현 요구사항: /api/toss/iap/unlock 에서 toss_order_id 기존 row 발견 시
 * feature/ref 신뢰성 검사 없이 { unlocked: true } 반환 (restore 경로).
 */
export async function restorePendingOrders(token: string | null): Promise<void> {
  try {
    const result = await IAP.getPendingOrders();
    if (!result || !Array.isArray(result.orders) || result.orders.length === 0) return;

    for (const order of result.orders) {
      const { orderId } = order;
      if (!orderId) continue;

      try {
        // 서버가 toss_order_id = 'iap_' + orderId 로 기존 row 를 찾아 멱등 처리.
        // 복구 경로에서 feature='hapcard', ref='' 는 서버 멱등 경로에서 무시됨.
        // 기존 row 없으면 서버가 오류 반환 → catch 에서 skip.
        const res = await callServerUnlock(orderId, 'hapcard' as IapFeature, '', token);
        if (res) {
          // 지급 완료 마킹 — §4.3 이중 중첩 params.params.orderId
          await IAP.completeProductGrant({ params: { orderId } });
        }
      } catch {
        // 개별 주문 복구 실패 — 무시하고 계속 (best-effort)
      }
    }
  } catch {
    // getPendingOrders 자체 실패(미지원 버전 등) — 무시
  }
}
