import { describe, expect, it } from 'vitest';

import {
  createTossCustomerKey,
  createTossOrderId,
  isValidTossCustomerKey,
  isValidTossOrderId,
} from '@/lib/payments/ids';

describe('Toss payment identifiers', () => {
  it('orderId는 6~64자 영문/숫자/-/_ 형식으로 생성한다', () => {
    const orderId = createTossOrderId(() => 1770000000000);

    expect(orderId).toMatch(/^[A-Za-z0-9_-]{6,64}$/);
    expect(isValidTossOrderId(orderId)).toBe(true);
  });

  it('customerKey는 UUID 기반 예측 불가능 키와 특수문자를 포함한다', () => {
    const first = createTossCustomerKey();
    const second = createTossCustomerKey();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_=.@-]{2,300}$/);
    expect(first).toMatch(/[-_=.@]/);
    expect(isValidTossCustomerKey(first)).toBe(true);
  });
});
