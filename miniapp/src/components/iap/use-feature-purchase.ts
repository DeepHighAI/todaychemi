/**
 * use-feature-purchase.ts — PAYMENT_REQUIRED 가로채기 + IAP 결제 훅
 *
 * 사용법:
 *   const { purchase, isPurchasing, purchaseError } = useFeaturePurchase({
 *     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hapcard', ...] }),
 *   });
 *
 *   // ApiError 402 catch 블록에서:
 *   if (err.status === 402 && err.payment) {
 *     purchase(err.payment);
 *   }
 *
 * 성공 시 onSuccess 콜백 호출 → TanStack Query invalidate/refetch.
 * 결제 취소/실패 시 purchaseError 상태 업데이트.
 */

import { useState, useCallback } from 'react';
import {
  isIapSkuNotConfiguredError,
  purchaseFeature,
  type PurchaseFeatureResult,
} from '@/lib/iap/purchase';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { PaymentRequiredInfo } from '@/lib/api/client';
import type { IapFeature } from '@/lib/iap/sku';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface UseFeaturePurchaseOptions {
  /** 결제 + 서버 unlock 성공 후 호출 (쿼리 무효화 등) */
  onSuccess?: (result: PurchaseFeatureResult) => void | Promise<void>;
}

export interface UseFeaturePurchaseReturn {
  /** IAP 시트를 열어 결제를 시작한다 (PaymentRequiredInfo 전달) */
  purchase: (info: PaymentRequiredInfo) => void;
  /** 결제 진행 중 여부 */
  isPurchasing: boolean;
  /** 마지막 결제 오류 (취소/실패 등). null = 오류 없음 */
  purchaseError: Error | null;
  /** 사용자에게 표시할 결제 오류 문구. null = 오류 없음 */
  purchaseErrorMessage: string | null;
  /** 오류 상태 초기화 */
  clearError: () => void;
}

const PURCHASE_ERROR_TEXT = '결제 중 오류가 발생했어요. 다시 시도해 주세요.';
const SKU_NOT_CONFIGURED_TEXT = '결제 상품 설정을 확인 중이에요. 잠시 후 다시 시도해 주세요.';

function formatPurchaseError(error: Error | null): string | null {
  if (!error) return null;
  return isIapSkuNotConfiguredError(error) ? SKU_NOT_CONFIGURED_TEXT : PURCHASE_ERROR_TEXT;
}

// ---------------------------------------------------------------------------
// 훅
// ---------------------------------------------------------------------------

export function useFeaturePurchase(
  options: UseFeaturePurchaseOptions = {},
): UseFeaturePurchaseReturn {
  const { onSuccess } = options;
  const { token } = useAuth();

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<Error | null>(null);

  const purchase = useCallback(
    (info: PaymentRequiredInfo) => {
      // feature 가 IapFeature 유니온 멤버인지 검증
      const validFeatures: IapFeature[] = ['hapcard', 'whatif', 'replay', 'relation_slot'];
      if (!validFeatures.includes(info.feature as IapFeature)) {
        setPurchaseError(new Error(`Unknown feature: ${info.feature}`));
        return;
      }

      setIsPurchasing(true);
      setPurchaseError(null);

      purchaseFeature({
        feature: info.feature as IapFeature,
        ref: info.ref,
        amountKrw: info.amount_krw,
        token,
      })
        .then(async (result) => {
          setIsPurchasing(false);
          await onSuccess?.(result);
        })
        .catch((err: unknown) => {
          setIsPurchasing(false);
          setPurchaseError(err instanceof Error ? err : new Error(String(err)));
        });
    },
    [token, onSuccess],
  );

  const clearError = useCallback(() => setPurchaseError(null), []);
  const purchaseErrorMessage = formatPurchaseError(purchaseError);

  return { purchase, isPurchasing, purchaseError, purchaseErrorMessage, clearError };
}
