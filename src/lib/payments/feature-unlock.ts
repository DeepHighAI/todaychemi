import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

import type { FeatureId } from './feature-prices';

type ServiceClient = SupabaseClient<Database>;

// pay-per-use 단일 잠금 게이트 (ADR-039, 모델 C).
// 선생성된 결과 본문을 반환해도 되는지 판단하는 단일 진실:
//   무료 경로 — token_ledger 에 {feature}_use(reference_id=ref) 차감 기록 존재, 또는
//   현금 경로 — payments 에 confirmed 피처결제(feature_ref=ref) 존재.
// 별도 entitlement 테이블 없이 token_ledger·payments 가 곧 잠금해제 레코드다.
export async function isFeatureUnlocked(
  service: ServiceClient,
  userId: string,
  feature: FeatureId,
  ref: string,
): Promise<boolean> {
  // 1. 무료 경로 — 부적 차감 기록.
  const ledgerRes = await service
    .from('token_ledger')
    .select('ledger_id')
    .eq('user_id', userId)
    .eq('reason', `${feature}_use`)
    .eq('reference_id', ref)
    .limit(1)
    .maybeSingle();
  if (ledgerRes.error) throw ledgerRes.error;
  if (ledgerRes.data) return true;

  // 2. 현금 경로 — 확정된 피처 결제.
  const paymentRes = await service
    .from('payments')
    .select('payment_id')
    .eq('user_id', userId)
    .eq('feature_id', feature)
    .eq('feature_ref', ref)
    .eq('status', 'confirmed')
    .limit(1)
    .maybeSingle();
  if (paymentRes.error) throw paymentRes.error;
  return Boolean(paymentRes.data);
}
