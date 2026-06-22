import { afterEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  createOneTimePurchaseOrder: vi.fn(),
  getPendingOrders: vi.fn(),
  completeProductGrant: vi.fn(),
}));

const api = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  IAP: {
    createOneTimePurchaseOrder: sdk.createOneTimePurchaseOrder,
    getPendingOrders: sdk.getPendingOrders,
    completeProductGrant: sdk.completeProductGrant,
  },
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: api.apiFetch,
}));

async function loadPurchaseModule(skuMap = '') {
  vi.resetModules();
  vi.stubEnv('VITE_TOSS_IAP_SKU_HAPCARD', '');
  vi.stubEnv('VITE_TOSS_IAP_SKU_MAP', skuMap);
  return import('./purchase');
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('purchaseFeature', () => {
  it('SKU 가 비어 있으면 Toss IAP 시트를 열지 않고 fail-closed 한다', async () => {
    const { purchaseFeature } = await loadPurchaseModule();

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

  it('IAP_SKU_NOT_CONFIGURED 형태의 plain error 를 식별한다', async () => {
    const { isIapSkuNotConfiguredError } = await loadPurchaseModule();

    expect(isIapSkuNotConfiguredError({ code: 'IAP_SKU_NOT_CONFIGURED' })).toBe(true);
    expect(isIapSkuNotConfiguredError(new Error('boom'))).toBe(false);
  });

  it('grant 실패 후 복구 시 원래 feature/ref 로 서버 unlock 을 재시도한다', async () => {
    const { purchaseFeature, restorePendingOrders } = await loadPurchaseModule('{"hapcard":"sku_hapcard"}');
    let processProductGrant!: (params: { orderId: string }) => Promise<boolean>;

    sdk.createOneTimePurchaseOrder.mockImplementation(({ options }) => {
      processProductGrant = options.processProductGrant;
      return vi.fn();
    });
    api.apiFetch
      .mockRejectedValueOnce(new Error('order-status lag'))
      .mockResolvedValueOnce({ unlocked: true });
    sdk.getPendingOrders.mockResolvedValue({ orders: [{ orderId: 'order-1' }] });

    const purchasePromise = purchaseFeature({
      feature: 'hapcard',
      ref: 'hapcard-cache-key-1',
      amountKrw: 550,
      token: 'tok',
    });

    await expect(processProductGrant({ orderId: 'order-1' })).resolves.toBe(false);
    await expect(purchasePromise).rejects.toMatchObject({
      code: 'IAP_PRODUCT_GRANT_FAILED',
      feature: 'hapcard',
    });
    await restorePendingOrders('tok');

    expect(api.apiFetch).toHaveBeenLastCalledWith('/api/toss/iap/unlock', expect.objectContaining({
      body: {
        orderId: 'order-1',
        feature: 'hapcard',
        ref: 'hapcard-cache-key-1',
      },
      token: 'tok',
    }));
    expect(sdk.completeProductGrant).toHaveBeenCalledWith({ params: { orderId: 'order-1' } });
  });

  it('서버 unlock 이 delivery 를 반환하면 purchaseFeature 가 delivery 를 resolve 한다', async () => {
    const { purchaseFeature } = await loadPurchaseModule('{"relation_slot":"sku_relation"}');
    let processProductGrant!: (params: { orderId: string }) => Promise<boolean>;
    const delivery = {
      feature: 'relation_slot' as const,
      relation_id: 'rel-delivered-001',
    };

    sdk.createOneTimePurchaseOrder.mockImplementation(({ options }) => {
      processProductGrant = options.processProductGrant;
      return vi.fn();
    });
    api.apiFetch.mockResolvedValue({ unlocked: true, delivery });

    const purchasePromise = purchaseFeature({
      feature: 'relation_slot',
      ref: 'relation_slot:pending-001',
      amountKrw: 550,
      token: 'tok',
    });

    await expect(processProductGrant({ orderId: 'order-1' })).resolves.toBe(true);
    await expect(purchasePromise).resolves.toEqual({ unlocked: true, delivery });
  });

  it('order-status 지연성 402 는 processProductGrant 안에서 재시도해 true 로 지급 완료한다', async () => {
    vi.useFakeTimers();
    const { purchaseFeature } = await loadPurchaseModule('{"hapcard":"sku_hapcard"}');
    let processProductGrant!: (params: { orderId: string }) => Promise<boolean>;

    sdk.createOneTimePurchaseOrder.mockImplementation(({ options }) => {
      processProductGrant = options.processProductGrant;
      return vi.fn();
    });
    api.apiFetch
      .mockRejectedValueOnce({ status: 402, code: 'IAP_ORDER_NOT_GRANTABLE' })
      .mockResolvedValueOnce({ unlocked: true });

    const purchasePromise = purchaseFeature({
      feature: 'hapcard',
      ref: 'hapcard-cache-key-1',
      amountKrw: 550,
      token: 'tok',
    });

    const grantPromise = processProductGrant({ orderId: 'order-1' });
    await vi.advanceTimersByTimeAsync(250);

    await expect(grantPromise).resolves.toBe(true);
    await expect(purchasePromise).resolves.toEqual({ unlocked: true });
    expect(api.apiFetch).toHaveBeenCalledTimes(2);
  });

  it('저장된 feature/ref 가 없는 pending 주문은 서버 unlock 과 grant 완료를 건너뛴다', async () => {
    const { restorePendingOrders } = await loadPurchaseModule('{"hapcard":"sku_hapcard"}');
    sdk.getPendingOrders.mockResolvedValue({ orders: [{ orderId: 'orphan-order' }] });
    api.apiFetch.mockResolvedValue({ unlocked: true });

    await restorePendingOrders('tok');

    expect(api.apiFetch).not.toHaveBeenCalled();
    expect(sdk.completeProductGrant).not.toHaveBeenCalled();
  });
});
