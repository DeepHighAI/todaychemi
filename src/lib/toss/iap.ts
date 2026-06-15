/**
 * iap.ts
 *
 * Apps-in-Toss IAP(인앱 결제) 서버 래퍼.
 *
 * ⚠️ 이 모듈을 import 하는 Route Handler 는 반드시:
 *   export const runtime = 'nodejs';
 * 를 선언해야 한다. mTLS = Node https 전용, Edge runtime 금지.
 *
 * 출처: 구현 레퍼런스 §4.5(order-status API), §4.6(환불), §4.7(SKU)
 */

import { mtlsRequest, TOSS_API_BASE_URL } from '@/lib/toss/mtls-client';
import type { MtlsTransport } from '@/types/toss';
import type { FeatureId } from '@/lib/payments/feature-prices';

// ---------------------------------------------------------------------------
// IAP order-status enum (§4.5, 8값 verbatim)
// ---------------------------------------------------------------------------

/**
 * 토스 IAP 주문 상태 8값 열거형.
 * PURCHASED: 결제 + 지급 완료 → 잠금해제 허용.
 * PAYMENT_COMPLETED: 결제 완료, 지급 실패 → 잠금해제 허용 (SDK 1.1.3+).
 * 그 외: 잠금해제 불가.
 */
export type IapOrderStatus =
  | 'PURCHASED'
  | 'PAYMENT_COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'ORDER_IN_PROGRESS'
  | 'NOT_FOUND'
  | 'MINIAPP_MISMATCH'
  | 'ERROR';

/** order-status API 성공 응답 */
export interface IapOrderStatusSuccess {
  /** uuid v7 형식 주문 ID */
  orderId: string;
  /** 콘솔에 등록한 상품 SKU 문자열 */
  sku: string;
  /** 상태 확정 시각 KST — 'yyyy-MM-dd'T'HH:mm:ss' */
  statusDeterminedAt: string;
  /** 주문 상태 */
  status: IapOrderStatus;
  /** 상태 부연 사유 (선택) */
  reason?: string;
}

// ---------------------------------------------------------------------------
// 허용 상태 — 잠금해제 가능 상태
// ---------------------------------------------------------------------------

/** 피처 잠금해제가 허용되는 IAP 상태 집합 */
const GRANTABLE_STATUSES: ReadonlySet<IapOrderStatus> = new Set([
  'PURCHASED',
  'PAYMENT_COMPLETED',
]);

export function isGrantableStatus(status: IapOrderStatus): boolean {
  return GRANTABLE_STATUSES.has(status);
}

// ---------------------------------------------------------------------------
// SKU ↔ feature 매핑 (환경변수 TOSS_IAP_SKU_MAP 단일 출처)
// ---------------------------------------------------------------------------

/**
 * TOSS_IAP_SKU_MAP 환경변수에서 SKU → feature 매핑을 읽는다.
 *
 * 형식: "hapcard:sku_abc,whatif:sku_def,replay:sku_ghi,relation_slot:sku_jkl"
 * feature 이름과 SKU 문자열을 콜론으로 구분, 항목은 쉼표로 구분.
 *
 * 환경변수 미설정 시 빈 Map 반환 → 모든 sku 검증 실패 (의도된 동작).
 */
export function buildSkuToFeatureMap(rawEnv?: string): Map<string, FeatureId> {
  const map = new Map<string, FeatureId>();
  const raw = rawEnv ?? process.env.TOSS_IAP_SKU_MAP ?? '';
  if (!raw.trim()) return map;

  // "feature:sku,feature:sku" 파싱
  for (const entry of raw.split(',')) {
    const colon = entry.indexOf(':');
    if (colon < 1) continue;
    const feature = entry.slice(0, colon).trim() as FeatureId;
    const sku = entry.slice(colon + 1).trim();
    if (feature && sku) {
      map.set(sku, feature);
    }
  }
  return map;
}

/**
 * SKU 문자열에서 FeatureId 를 해석한다.
 *
 * @param sku - 토스 order-status 응답의 sku 필드
 * @param rawEnv - TOSS_IAP_SKU_MAP 원시 문자열 (테스트 주입용). 미전달 시 env 에서 읽음.
 * @returns FeatureId 또는 null (매핑 없음)
 */
export function resolveFeatureFromSku(sku: string, rawEnv?: string): FeatureId | null {
  const map = buildSkuToFeatureMap(rawEnv);
  return map.get(sku) ?? null;
}

// ---------------------------------------------------------------------------
// getOrderStatus — order-status API mTLS 래퍼 (§4.5)
// ---------------------------------------------------------------------------

/**
 * Apps-in-Toss order-status API 를 호출해 주문 상태를 조회한다.
 *
 * - POST /api-partner/v1/apps-in-toss/order/get-order-status
 * - header x-toss-user-key: 선택(생략 시 전체 주문, 포함 시 해당 userKey 주문만)
 * - body: { orderId }
 *
 * 봉투 판별 직접 수행(SUCCESS/FAIL).
 * NOT_FOUND orderId → IapOrderStatusSuccess with status='NOT_FOUND' 반환.
 */
export async function getOrderStatus(
  orderId: string,
  opts?: { tossUserKey?: number; transport?: MtlsTransport },
): Promise<IapOrderStatusSuccess> {
  const headers: Record<string, string> = {};
  if (opts?.tossUserKey !== undefined) {
    // x-toss-user-key: 해당 userKey 의 주문만 조회(소유 검증 강화)
    headers['x-toss-user-key'] = String(opts.tossUserKey);
  }

  const raw = await mtlsRequest(
    {
      baseUrl: TOSS_API_BASE_URL,
      method: 'POST',
      path: '/api-partner/v1/apps-in-toss/order/get-order-status',
      headers,
      body: { orderId },
    },
    opts?.transport,
  );

  // 공통 봉투 파싱 (§3.6)
  const envelope = raw as {
    resultType?: string;
    success?: IapOrderStatusSuccess;
    error?: { errorCode?: string; reason?: string };
  };

  if (envelope.resultType === 'SUCCESS' && envelope.success) {
    return envelope.success;
  }

  if (envelope.resultType === 'FAIL') {
    // FAIL 봉투 — 구조화 에러로 변환
    const code = envelope.error?.errorCode ?? 'UNKNOWN';
    const reason = envelope.error?.reason ?? '';
    throw new IapOrderError(code, reason, orderId);
  }

  // 알 수 없는 shape
  throw new IapOrderError('UNKNOWN_SHAPE', `unexpected response shape`, orderId);
}

// ---------------------------------------------------------------------------
// IapOrderError — 도메인 에러 클래스
// ---------------------------------------------------------------------------

export class IapOrderError extends Error {
  /** 토스 errorCode 또는 내부 오류 코드 */
  readonly code: string;
  /** orderId */
  readonly orderId: string;

  constructor(code: string, message: string, orderId: string) {
    super(`[IapOrderError] ${code}: ${message} (orderId=${orderId})`);
    this.name = 'IapOrderError';
    this.code = code;
    this.orderId = orderId;
  }
}

// ---------------------------------------------------------------------------
// markRefunded — 환불 조회 헬퍼 (poll-based 조정, §4.6)
// ---------------------------------------------------------------------------

/**
 * 주어진 orderId 의 최신 상태를 조회해 REFUNDED 여부를 반환한다.
 *
 * 사용: 웹훅이 없으므로 poll-based 환불 조정 시 이 함수를 주기적으로 호출.
 * 실제 de-grant 로직(isFeatureUnlocked 재확인)은 호출자 책임.
 *
 * ⚠️ 이 함수는 별도 Route Handler / cron 에서 사용. 환불 처리 자체는 Apple/Google 최종 결정.
 *    (§4.6: Android = 파트너 승인 가능하나 Google 최종, iOS = Apple 단독)
 */
export async function markRefunded(
  orderId: string,
  opts?: { tossUserKey?: number; transport?: MtlsTransport },
): Promise<boolean> {
  try {
    const result = await getOrderStatus(orderId, opts);
    return result.status === 'REFUNDED';
  } catch {
    // 조회 실패 시 false 반환 — 환불 여부 판단 불가, 보수적으로 미환불 처리
    return false;
  }
}
