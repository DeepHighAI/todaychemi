/**
 * iap.test.ts
 *
 * Toss IAP 라이브러리 단위 테스트.
 * 네트워크/인증서/DB 없이 transport mock 으로만 검증.
 */

import { describe, expect, it } from 'vitest';
import {
  getOrderStatus,
  resolveFeatureFromSku,
  buildSkuToFeatureMap,
  isGrantableStatus,
  markRefunded,
  IapOrderError,
} from '@/lib/toss/iap';
import type { MtlsTransport } from '@/types/toss';
import type { MtlsRequestOptions } from '@/types/toss';

// ---------------------------------------------------------------------------
// 픽스처 헬퍼
// ---------------------------------------------------------------------------

/** 토스 SUCCESS 봉투를 반환하는 mock transport */
function makeSuccessTransport(
  successPayload: object,
): MtlsTransport {
  return async (_opts: MtlsRequestOptions) => ({
    resultType: 'SUCCESS',
    success: successPayload,
  });
}

/** 토스 FAIL 봉투를 반환하는 mock transport */
function makeFailTransport(errorCode: string, reason = ''): MtlsTransport {
  return async (_opts: MtlsRequestOptions) => ({
    resultType: 'FAIL',
    error: { errorCode, reason },
  });
}

/** 알 수 없는 shape를 반환하는 mock transport */
function makeUnknownTransport(): MtlsTransport {
  return async () => ({ unexpected: true });
}

const ORDER_ID = 'order-uuid-v7-001';
const SAMPLE_SKU = 'ait.0000010000.af647449sample';

const SAMPLE_ORDER_STATUS = {
  orderId: ORDER_ID,
  sku: SAMPLE_SKU,
  statusDeterminedAt: '2026-06-14T12:00:00',
  status: 'PURCHASED' as const,
};

// ---------------------------------------------------------------------------
// getOrderStatus — PURCHASED 성공
// ---------------------------------------------------------------------------

describe('getOrderStatus', () => {
  it('PURCHASED 상태 → 성공 데이터 반환', async () => {
    const transport = makeSuccessTransport(SAMPLE_ORDER_STATUS);
    const result = await getOrderStatus(ORDER_ID, { transport });

    expect(result.orderId).toBe(ORDER_ID);
    expect(result.sku).toBe(SAMPLE_SKU);
    expect(result.status).toBe('PURCHASED');
  });

  it('PAYMENT_COMPLETED 상태 → 성공 데이터 반환', async () => {
    const transport = makeSuccessTransport({
      ...SAMPLE_ORDER_STATUS,
      status: 'PAYMENT_COMPLETED',
    });
    const result = await getOrderStatus(ORDER_ID, { transport });
    expect(result.status).toBe('PAYMENT_COMPLETED');
  });

  it('FAIL 봉투 → IapOrderError throw', async () => {
    const transport = makeFailTransport('INVALID_ORDER', '주문이 존재하지 않음');
    await expect(getOrderStatus(ORDER_ID, { transport })).rejects.toBeInstanceOf(IapOrderError);
  });

  it('FAIL 봉투 → IapOrderError 에 errorCode 포함', async () => {
    const transport = makeFailTransport('MINIAPP_MISMATCH');
    await expect(getOrderStatus(ORDER_ID, { transport })).rejects.toMatchObject({
      code: 'MINIAPP_MISMATCH',
    });
  });

  it('알 수 없는 봉투 shape → IapOrderError throw', async () => {
    const transport = makeUnknownTransport();
    await expect(getOrderStatus(ORDER_ID, { transport })).rejects.toBeInstanceOf(IapOrderError);
  });

  it('REFUNDED 상태 → 성공 데이터 반환(상태값 그대로)', async () => {
    // 환불됨 상태도 API 는 SUCCESS 봉투로 반환 — status 값으로 허용 여부 판단
    const transport = makeSuccessTransport({
      ...SAMPLE_ORDER_STATUS,
      status: 'REFUNDED',
    });
    const result = await getOrderStatus(ORDER_ID, { transport });
    expect(result.status).toBe('REFUNDED');
    // isGrantableStatus 는 false 여야 함
    expect(isGrantableStatus(result.status)).toBe(false);
  });

  it('FAILED 상태 → 잠금해제 불가', async () => {
    const transport = makeSuccessTransport({
      ...SAMPLE_ORDER_STATUS,
      status: 'FAILED',
    });
    const result = await getOrderStatus(ORDER_ID, { transport });
    expect(isGrantableStatus(result.status)).toBe(false);
  });

  it('x-toss-user-key 옵션 전달 시 요청 헤더에 포함', async () => {
    let capturedOpts: MtlsRequestOptions | undefined;
    const transport: MtlsTransport = async (opts) => {
      capturedOpts = opts;
      return { resultType: 'SUCCESS', success: SAMPLE_ORDER_STATUS };
    };
    await getOrderStatus(ORDER_ID, { tossUserKey: 443731103, transport });
    expect(capturedOpts?.headers?.['x-toss-user-key']).toBe('443731103');
  });

  it('x-toss-user-key 미전달 시 헤더 없음', async () => {
    let capturedOpts: MtlsRequestOptions | undefined;
    const transport: MtlsTransport = async (opts) => {
      capturedOpts = opts;
      return { resultType: 'SUCCESS', success: SAMPLE_ORDER_STATUS };
    };
    await getOrderStatus(ORDER_ID, { transport });
    expect(capturedOpts?.headers?.['x-toss-user-key']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isGrantableStatus
// ---------------------------------------------------------------------------

describe('isGrantableStatus', () => {
  it('PURCHASED → true', () => {
    expect(isGrantableStatus('PURCHASED')).toBe(true);
  });

  it('PAYMENT_COMPLETED → true', () => {
    expect(isGrantableStatus('PAYMENT_COMPLETED')).toBe(true);
  });

  it('REFUNDED → false', () => {
    expect(isGrantableStatus('REFUNDED')).toBe(false);
  });

  it('FAILED → false', () => {
    expect(isGrantableStatus('FAILED')).toBe(false);
  });

  it('ORDER_IN_PROGRESS → false', () => {
    expect(isGrantableStatus('ORDER_IN_PROGRESS')).toBe(false);
  });

  it('NOT_FOUND → false', () => {
    expect(isGrantableStatus('NOT_FOUND')).toBe(false);
  });

  it('MINIAPP_MISMATCH → false', () => {
    expect(isGrantableStatus('MINIAPP_MISMATCH')).toBe(false);
  });

  it('ERROR → false', () => {
    expect(isGrantableStatus('ERROR')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildSkuToFeatureMap / resolveFeatureFromSku
// ---------------------------------------------------------------------------

describe('buildSkuToFeatureMap', () => {
  it('올바른 형식 → 4개 feature 매핑', () => {
    const raw =
      'hapcard:sku_hap,whatif:sku_wif,replay:sku_rep,relation_slot:sku_rel';
    const map = buildSkuToFeatureMap(raw);
    expect(map.get('sku_hap')).toBe('hapcard');
    expect(map.get('sku_wif')).toBe('whatif');
    expect(map.get('sku_rep')).toBe('replay');
    expect(map.get('sku_rel')).toBe('relation_slot');
  });

  it('빈 문자열 → 빈 Map', () => {
    const map = buildSkuToFeatureMap('');
    expect(map.size).toBe(0);
  });

  it('공백만 있는 문자열 → 빈 Map', () => {
    const map = buildSkuToFeatureMap('   ');
    expect(map.size).toBe(0);
  });

  it('잘못된 형식 항목은 무시', () => {
    // 콜론 없음 → 무시
    const map = buildSkuToFeatureMap('hapcard:sku_hap,invalid_entry,replay:sku_rep');
    expect(map.size).toBe(2);
    expect(map.get('sku_hap')).toBe('hapcard');
  });
});

describe('resolveFeatureFromSku', () => {
  const SKU_MAP = 'hapcard:sku_hap,whatif:sku_wif,replay:sku_rep,relation_slot:sku_rel';

  it('매핑된 SKU → 올바른 feature 반환', () => {
    expect(resolveFeatureFromSku('sku_hap', SKU_MAP)).toBe('hapcard');
    expect(resolveFeatureFromSku('sku_wif', SKU_MAP)).toBe('whatif');
    expect(resolveFeatureFromSku('sku_rep', SKU_MAP)).toBe('replay');
    expect(resolveFeatureFromSku('sku_rel', SKU_MAP)).toBe('relation_slot');
  });

  it('미등록 SKU → null', () => {
    expect(resolveFeatureFromSku('sku_unknown', SKU_MAP)).toBeNull();
  });

  it('빈 환경변수 → null', () => {
    expect(resolveFeatureFromSku('sku_hap', '')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// markRefunded
// ---------------------------------------------------------------------------

describe('markRefunded', () => {
  it('REFUNDED 상태 → true', async () => {
    const transport = makeSuccessTransport({ ...SAMPLE_ORDER_STATUS, status: 'REFUNDED' });
    const result = await markRefunded(ORDER_ID, { transport });
    expect(result).toBe(true);
  });

  it('PURCHASED 상태 → false', async () => {
    const transport = makeSuccessTransport({ ...SAMPLE_ORDER_STATUS, status: 'PURCHASED' });
    const result = await markRefunded(ORDER_ID, { transport });
    expect(result).toBe(false);
  });

  it('API 오류(FAIL 봉투) → false (보수적 처리)', async () => {
    const transport = makeFailTransport('INTERNAL_ERROR');
    const result = await markRefunded(ORDER_ID, { transport });
    expect(result).toBe(false);
  });
});
