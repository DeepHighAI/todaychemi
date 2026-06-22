import { afterEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  createOneTimePurchaseOrder: vi.fn(),
  getPendingOrders: vi.fn(),
  completeProductGrant: vi.fn(),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  IAP: {
    createOneTimePurchaseOrder: sdk.createOneTimePurchaseOrder,
    getPendingOrders: sdk.getPendingOrders,
    completeProductGrant: sdk.completeProductGrant,
  },
}));

import { isIapSkuNotConfiguredError, purchaseFeature } from './purchase';

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('purchaseFeature', () => {
  it('SKU 가 비어 있으면 Toss IAP 시트를 열지 않고 fail-closed 한다', async () => {
    vi.stubEnv('VITE_TOSS_IAP_SKU_HAPCARD', '');
    vi.stubEnv('VITE_TOSS_IAP_SKU_MAP', '');

    await expect(
      purchaseFeature({
        feature: 'hapcard',
        ref: 'ref-1',
        amountKrw: 550,
        token: 'tok',
      }),
    ).rejects.toMatchObject({
      code: 'IAP_SKU_NOT_CONFIGURED',
      feature: 'hapcard',
    });

    expect(sdk.createOneTimePurchaseOrder).not.toHaveBeenCalled();
  });

  it('IAP_SKU_NOT_CONFIGURED 형태의 plain error 를 식별한다', () => {
    expect(isIapSkuNotConfiguredError({ code: 'IAP_SKU_NOT_CONFIGURED' })).toBe(true);
    expect(isIapSkuNotConfiguredError(new Error('boom'))).toBe(false);
  });
});
