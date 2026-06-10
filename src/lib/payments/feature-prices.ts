import { z } from 'zod';

// pay-per-use 단일 출처 (ADR-039). 레거시 products.ts(토큰팩) + token-costs.ts 를 흡수한다.
// amount_krw = 잔액 부족 시 1회 즉시결제 금액. token_cost = 무료 부적 차감량(잔액 충분 시).
// order_name = Toss 결제창·영수증에 표시되는 정적 라벨 (PII 아님).
// 2026-06-07 §1.1 D6 개정: 800/500/400 → 1,000/800/600 (앱인토스 IAP 수수료 반영, 웹·미니앱 통일).
// token_cost = 1부적 = 100원 등가 유지 (8/5/4 → 10/8/6).
// llm_generated: LLM 선생성 비용이 있는 피처 — cash-gen 일일 한도의 피처/reason
// 리스트가 이 플래그에서 파생된다 (신규 피처 추가 시 3-list 드리프트 차단).
export const FEATURE_PRICES_KRW = {
  hapcard: {
    feature_id: 'hapcard',
    amount_krw: 1000,
    order_name: '케미카드 보기',
    token_cost: 10,
    llm_generated: true,
  },
  whatif: {
    feature_id: 'whatif',
    amount_krw: 800,
    order_name: '또 다른 나 보기',
    token_cost: 8,
    llm_generated: true,
  },
  replay: {
    feature_id: 'replay',
    amount_krw: 600,
    order_name: '케미 다시 맞추기',
    token_cost: 6,
    llm_generated: true,
  },
  // ADR-039 Amended 2026-06-10: 인연 등록 슬롯 — 2명까지 무료, 3번째부터 과금 (모델 B)
  relation_slot: {
    feature_id: 'relation_slot',
    amount_krw: 1000,
    order_name: '인연 등록',
    token_cost: 10,
    llm_generated: false,
  },
} as const;

// LLM 선생성 피처 id / 무료차감 reason — 카탈로그 단일 출처에서 파생.
export const LLM_GENERATED_FEATURES: readonly string[] = Object.values(FEATURE_PRICES_KRW)
  .filter((price) => price.llm_generated)
  .map((price) => price.feature_id);

export const LLM_FREE_USE_REASONS: readonly string[] = LLM_GENERATED_FEATURES.map(
  (feature) => `${feature}_use`,
);

export type FeatureId = keyof typeof FEATURE_PRICES_KRW;
export type FeaturePrice = (typeof FEATURE_PRICES_KRW)[FeatureId];

export const FeatureIdSchema = z.enum(['hapcard', 'whatif', 'replay', 'relation_slot']);

// 인연 무료 슬롯 수 — 이 수 미만 보유 시 등록 무료, 이상이면 relation_slot 과금 (모델 B).
// 서버 게이트(/api/relations)와 클라이언트 사전 고지가 공유하는 단일 출처.
export const FREE_RELATION_SLOTS = 2;

// 서버 신뢰 단일 출처. 클라이언트가 보낸 feature 문자열은 반드시 이 함수로 검증한다.
export function getFeaturePrice(id: string): FeaturePrice | null {
  const parsed = FeatureIdSchema.safeParse(id);
  if (!parsed.success) return null;
  return FEATURE_PRICES_KRW[parsed.data];
}
