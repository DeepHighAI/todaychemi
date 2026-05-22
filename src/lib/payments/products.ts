import { z } from 'zod';

export const TOSS_PRODUCTS = {
  tokens_10: {
    product_id: 'tokens_10',
    tokens: 10,
    amount_krw: 1000,
    order_name: '부적 10개',
    label: '가볍게 시작',
  },
  tokens_50: {
    product_id: 'tokens_50',
    tokens: 55,
    amount_krw: 4500,
    order_name: '부적 55개',
    label: '자주 쓰는 분께',
  },
  tokens_100: {
    product_id: 'tokens_100',
    tokens: 120,
    amount_krw: 8000,
    order_name: '부적 120개',
    label: '넉넉하게 준비',
  },
} as const;

export type TossProductId = keyof typeof TOSS_PRODUCTS;
export type TossProduct = (typeof TOSS_PRODUCTS)[TossProductId];

export const TossProductIdSchema = z.enum(['tokens_10', 'tokens_50', 'tokens_100']);

export function getTossProduct(productId: string): TossProduct | null {
  const parsed = TossProductIdSchema.safeParse(productId);
  if (!parsed.success) return null;
  return TOSS_PRODUCTS[parsed.data];
}

export function listTossProducts(): TossProduct[] {
  return Object.values(TOSS_PRODUCTS);
}
