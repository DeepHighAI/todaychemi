import { randomUUID } from 'crypto';

export const TOSS_ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
export const TOSS_CUSTOMER_KEY_PATTERN = /^[A-Za-z0-9_=.@-]{2,300}$/;

const ORDER_ID_PREFIX = 'twoday';
const CUSTOMER_KEY_PREFIX = 'customer';
const UUID_SHORT_LENGTH = 16;

export function createTossOrderId(now = Date.now): string {
  const entropy = randomUUID().replaceAll('-', '').slice(0, UUID_SHORT_LENGTH);
  return `${ORDER_ID_PREFIX}_${now()}_${entropy}`;
}

export function createTossCustomerKey(): string {
  return `${CUSTOMER_KEY_PREFIX}_${randomUUID()}`;
}

export function isValidTossOrderId(orderId: string): boolean {
  return TOSS_ORDER_ID_PATTERN.test(orderId);
}

export function isValidTossCustomerKey(customerKey: string): boolean {
  return TOSS_CUSTOMER_KEY_PATTERN.test(customerKey) && /[-_=.@]/.test(customerKey);
}
