import type { PaymentRequiredInfo } from '@/lib/api/client';

export type FeaturePreflightMode = 'unlocked' | 'token_required' | 'pay_required' | 'free';

export interface FeaturePreflightResponse {
  mode: FeaturePreflightMode;
  feature?: string;
  ref?: string;
  token_cost?: number;
  amount_krw?: number;
  balance?: number;
  shortage?: number;
  payment: PaymentRequiredInfo | null;
}

export function tokenUseConfirmText(tokenCost: number): string {
  return `부적 ${tokenCost}개가 사용됩니다? 사용하시겠습니까?`;
}

export function shortageText(balance = 0, shortage = 0): string {
  if (shortage <= 0) return `보유 부적 ${balance}개를 먼저 확인했어요.`;
  return `보유 부적 ${balance}개가 있어요. 부적 ${shortage}개가 부족해 결제가 필요해요.`;
}
