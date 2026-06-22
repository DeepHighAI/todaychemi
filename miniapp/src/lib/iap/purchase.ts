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
// 미결 주문 컨텍스트 저장
// ---------------------------------------------------------------------------

const PENDING_IAP_CONTEXT_STORAGE_KEY = 'todaychemi_iap_pending_context_v1';
const PENDING_IAP_CONTEXT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const IAP_GRANT_RETRY_DELAYS_MS = [250, 750, 1500, 3000, 5000] as const;

interface PendingIapContext {
  orderId: string;
  feature: IapFeature;
  ref: string;
  createdAt: number;
}

const IAP_FEATURES = new Set<IapFeature>(['hapcard', 'whatif', 'replay', 'relation_slot']);

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isPendingIapContext(value: unknown): value is PendingIapContext {
  if (typeof value !== 'object' || value === null) return false;
  const ctx = value as Partial<PendingIapContext>;
  return (
    typeof ctx.orderId === 'string' &&
    ctx.orderId.trim().length > 0 &&
    typeof ctx.feature === 'string' &&
    IAP_FEATURES.has(ctx.feature as IapFeature) &&
    typeof ctx.ref === 'string' &&
    ctx.ref.trim().length > 0 &&
    typeof ctx.createdAt === 'number' &&
    Number.isFinite(ctx.createdAt)
  );
}

function readPendingIapContexts(): Record<string, PendingIapContext> {
  const storage = getLocalStorage();
  if (!storage) return {};

  const raw = storage.getItem(PENDING_IAP_CONTEXT_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const now = Date.now();
    const contexts: Record<string, PendingIapContext> = {};

    for (const [orderId, value] of Object.entries(parsed)) {
      if (!isPendingIapContext(value)) continue;
      if (now - value.createdAt > PENDING_IAP_CONTEXT_MAX_AGE_MS) continue;
      contexts[orderId] = value;
    }

    if (Object.keys(contexts).length !== Object.keys(parsed).length) {
      writePendingIapContexts(contexts);
    }

    return contexts;
  } catch {
    storage.removeItem(PENDING_IAP_CONTEXT_STORAGE_KEY);
    return {};
  }
}

function writePendingIapContexts(contexts: Record<string, PendingIapContext>): void {
  const storage = getLocalStorage();
  if (!storage) return;

  const entries = Object.entries(contexts);
  if (entries.length === 0) {
    storage.removeItem(PENDING_IAP_CONTEXT_STORAGE_KEY);
    return;
  }

  storage.setItem(PENDING_IAP_CONTEXT_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

function rememberPendingIapContext(orderId: string, feature: IapFeature, ref: string): void {
  const cleanOrderId = orderId.trim();
  if (!cleanOrderId || !ref.trim()) return;

  const contexts = readPendingIapContexts();
  contexts[cleanOrderId] = {
    orderId: cleanOrderId,
    feature,
    ref,
    createdAt: Date.now(),
  };
  writePendingIapContexts(contexts);
}

function findPendingIapContext(orderId: string): PendingIapContext | null {
  const cleanOrderId = orderId.trim();
  if (!cleanOrderId) return null;
  return readPendingIapContexts()[cleanOrderId] ?? null;
}

function forgetPendingIapContext(orderId: string): void {
  const cleanOrderId = orderId.trim();
  if (!cleanOrderId) return;

  const contexts = readPendingIapContexts();
  if (!(cleanOrderId in contexts)) return;
  delete contexts[cleanOrderId];
  writePendingIapContexts(contexts);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getErrorStatusAndCode(error: unknown): { status?: number; code?: string } {
  if (typeof error !== 'object' || error === null) return {};
  const record = error as { status?: unknown; code?: unknown };
  return {
    status: typeof record.status === 'number' ? record.status : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
  };
}

function isRetryableUnlockError(error: unknown): boolean {
  const { status, code } = getErrorStatusAndCode(error);

  if (status === 402) {
    return code === 'IAP_ORDER_NOT_GRANTABLE' || code === 'IAP_ORDER_NOT_FOUND';
  }

  if (typeof status === 'number') {
    return status >= 500;
  }

  return error instanceof TypeError;
}

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
  unlocked: true;
  delivery?: {
    feature: 'relation_slot';
    relation_id: string;
  };
}

export type PurchaseFeatureResult = UnlockResponse;

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
): Promise<UnlockResponse | null> {
  for (let attempt = 0; attempt <= IAP_GRANT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await apiFetch<UnlockResponse>('/api/toss/iap/unlock', {
        method: 'POST',
        token,
        body: { orderId, feature, ref },
      });
      return res.unlocked === true ? res : null;
    } catch (error) {
      const delayMs = IAP_GRANT_RETRY_DELAYS_MS[attempt];
      if (delayMs === undefined || !isRetryableUnlockError(error)) {
        return null;
      }
      await delay(delayMs);
    }
  }

  return null;
}

export class IapProductGrantFailedError extends Error {
  readonly code = 'IAP_PRODUCT_GRANT_FAILED';
  readonly feature: IapFeature;

  constructor(feature: IapFeature) {
    super(`IAP product grant failed for ${feature}`);
    this.name = 'IapProductGrantFailedError';
    this.feature = feature;
  }
}

// ---------------------------------------------------------------------------
// 메인 구매 함수
// ---------------------------------------------------------------------------

/**
 * Toss IAP 시트를 열고, 결제 성공 시 서버 unlock 을 완료한다.
 * 완료되면 resolve, 실패하면 reject.
 */
export function purchaseFeature(params: PurchaseFeatureParams): Promise<PurchaseFeatureResult> {
  const { feature, ref, amountKrw: _amountKrw, token } = params;
  const sku = resolveIapSku(feature);

  if (!sku.trim()) {
    return Promise.reject(new IapSkuNotConfiguredError(feature));
  }

  return new Promise<PurchaseFeatureResult>((resolve, reject) => {
    let settled = false;
    const settleResolve = (result: PurchaseFeatureResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const settleReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    // §4.3 createOneTimePurchaseOrder — cleanup 반환
    const cleanup = IAP.createOneTimePurchaseOrder({
      options: {
        sku,
        /**
         * processProductGrant: 결제 성공 후 호출 (30초 창).
         * true 반환 → grant 완료. false → SDK 환불 안내 + getPendingOrders 복구 대상.
         */
        processProductGrant: async ({ orderId }: { orderId: string }): Promise<boolean> => {
          rememberPendingIapContext(orderId, feature, ref);
          const unlockResult = await callServerUnlock(orderId, feature, ref, token);
          if (unlockResult) {
            forgetPendingIapContext(orderId);
            settleResolve(unlockResult);
            return true;
          }
          settleReject(new IapProductGrantFailedError(feature));
          return false;
        },
      },
      onEvent: (event: { data?: { orderId?: string } }) => {
        // type: 'success' 이벤트 — processProductGrant 가 성공적으로 완료된 후 발화.
        // resolve 는 processProductGrant 내에서 이미 호출됨 — 중복 호출 무해.
        const orderId = event.data?.orderId;
        if (orderId) forgetPendingIapContext(orderId);
      },
      onError: (error: unknown) => {
        // 결제 취소/네트워크 오류 등 — reject 후 cleanup
        settleReject(error);
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
 *   2. 각 orderId: 저장해둔 feature/ref 로 /api/toss/iap/unlock 재시도
 *   3. completeProductGrant
 *
 * 주의: 저장된 feature/ref 가 없는 고아 주문은 skip 한다.
 * 빈 ref 로 서버 confirmed payment 를 만들면 실제 캐시 키가 잠금해제되지 않는다.
 */
export async function restorePendingOrders(token: string | null): Promise<void> {
  try {
    const result = await IAP.getPendingOrders();
    if (!result || !Array.isArray(result.orders) || result.orders.length === 0) return;

    for (const order of result.orders) {
      const { orderId } = order;
      if (!orderId) continue;

      try {
        const context = findPendingIapContext(orderId);
        if (!context) continue;

        const res = await callServerUnlock(orderId, context.feature, context.ref, token);
        if (res) {
          // 지급 완료 마킹 — §4.3 이중 중첩 params.params.orderId
          await IAP.completeProductGrant({ params: { orderId } });
          forgetPendingIapContext(orderId);
        }
      } catch {
        // 개별 주문 복구 실패 — 무시하고 계속 (best-effort)
      }
    }
  } catch {
    // getPendingOrders 자체 실패(미지원 버전 등) — 무시
  }
}
