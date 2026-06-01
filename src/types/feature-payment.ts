import type { FeatureId } from '@/lib/payments/feature-prices';

// pay-per-use 피처 결제 API 계약 (ADR-039). 토큰충전(wallet.ts)과 별개 — Phase 6 에서 wallet 결제 타입은 제거된다.

// /api/payments/feature/init 가 클라이언트 Toss 위젯 마운트에 필요한 값.
export interface FeaturePaymentInit {
  order_id: string;
  customer_key: string;
  client_key: string;
  amount_krw: number;
  order_name: string;
  feature: FeatureId;
  ref: string;
}

export type FeaturePaymentInitResponse =
  | { ok: true; unlocked: true } // 이미 확정결제 존재 — 위젯 없이 재요청하면 캐시 본문.
  | { ok: true; unlocked: false; payment: FeaturePaymentInit };
