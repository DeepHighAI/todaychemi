import type { IapFeature } from './sku';

// 미니앱 IAP 표시가 (KRW) — 단일 출처.
//
// 실제 청구는 Toss 콘솔 SKU 가격으로 이뤄진다(purchaseFeature 는 amountKrw 를 사용하지 않음).
// 이 값은 화면 표시·402 fallback 전용이며, SKU 등록가와 반드시 일치시켜야 한다.
//
// 웹앱 단일 출처 src/lib/payments/feature-prices.ts 의 amount_krw(오픈초기 50% 할인 적용가)와
// 동일하게 유지한다 — 웹·미니앱 가격 통일(ADR-039). 웹 단일 출처가 바뀌면 여기와 콘솔 SKU 도 갱신.
// (§1.3 TODO: 빌드시 웹 출처에서 파생하는 방법 검토.)
export const IAP_DISPLAY_PRICE_KRW: Record<IapFeature, number> = {
  hapcard: 500,
  whatif: 400,
  replay: 300,
  relation_slot: 500,
};
