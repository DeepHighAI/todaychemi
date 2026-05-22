import { describe, expect, it } from 'vitest';

import { getTossProduct, listTossProducts } from '@/lib/payments/products';

describe('TOSS_PRODUCTS', () => {
  it('서버 신뢰 상품 카탈로그를 부적 단위로 제공한다', () => {
    expect(listTossProducts()).toEqual([
      expect.objectContaining({ product_id: 'tokens_10', tokens: 10, amount_krw: 1000 }),
      expect.objectContaining({ product_id: 'tokens_50', tokens: 55, amount_krw: 4500 }),
      expect.objectContaining({ product_id: 'tokens_100', tokens: 120, amount_krw: 8000 }),
    ]);
  });

  it('알 수 없는 상품 id는 null로 거부한다', () => {
    expect(getTossProduct('tokens_999')).toBeNull();
  });
});
