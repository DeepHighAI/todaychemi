import { z } from 'zod';

// pay-per-use 단일 출처 (ADR-039). 레거시 products.ts(토큰팩) + token-costs.ts 를 흡수한다.
// amount_krw = 잔액 부족 시 1회 즉시결제 금액. token_cost = 무료 부적 차감량(잔액 충분 시).
// order_name = Toss 결제창·영수증에 표시되는 정적 라벨 (PII 아님).
export const FEATURE_PRICES_KRW = {
  hapcard: { feature_id: 'hapcard', amount_krw: 800, order_name: '합카드 보기', token_cost: 8 },
  whatif: { feature_id: 'whatif', amount_krw: 500, order_name: '만약합 보기', token_cost: 5 },
  replay: { feature_id: 'replay', amount_krw: 400, order_name: '다시합 보기', token_cost: 4 },
} as const;

export type FeatureId = keyof typeof FEATURE_PRICES_KRW;
export type FeaturePrice = (typeof FEATURE_PRICES_KRW)[FeatureId];

export const FeatureIdSchema = z.enum(['hapcard', 'whatif', 'replay']);

// 서버 신뢰 단일 출처. 클라이언트가 보낸 feature 문자열은 반드시 이 함수로 검증한다.
export function getFeaturePrice(id: string): FeaturePrice | null {
  const parsed = FeatureIdSchema.safeParse(id);
  if (!parsed.success) return null;
  return FEATURE_PRICES_KRW[parsed.data];
}
