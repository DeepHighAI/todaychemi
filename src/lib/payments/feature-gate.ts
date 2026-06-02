import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

import { FEATURE_PRICES_KRW, type FeatureId, type FeaturePrice } from './feature-prices';
import { isFeatureUnlocked } from './feature-unlock';

type ServiceClient = SupabaseClient<Database>;

export type FeatureChargeMode = 'free' | 'unlocked' | 'pay_required';

export interface FeatureChargeResolution {
  // free        — 이번 호출에서 부적 차감을 시도해 통과(무료 경로). buildHapcard 등 생성 후 본문 공개.
  // unlocked    — 이미 차감/현금결제로 잠금해제됨. 추가 과금 없이 캐시 본문 공개.
  // pay_required — 잔액 부족. 선생성 후 402 로 현금 결제를 요구해야 함.
  mode: FeatureChargeMode;
  price: FeaturePrice;
  // 이번 호출이 실제로 부적을 새로 차감했는지 (생성 실패 시 환불 대상). mode==='free' && inserted 일 때만 true.
  charged: boolean;
}

// deduct_tokens_once 는 jsonb { balance_after, inserted } 를 반환. inserted=true 만 신규 차감.
function tokenRpcInserted(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return (data as { inserted?: unknown }).inserted === true;
}

// 하이브리드 과금 분기 (§1.1 결정 1). 3개 피처 라우트가 공유하는 단일 게이트.
//   1) 이미 잠금해제 → unlocked (과금 없음)
//   2) 부적 차감 성공 → free (무료 경로, 현행 동작 불변)
//   3) 잔액 부족 → pay_required (선생성 + 현금 즉시결제)
export async function resolveFeatureCharge(
  service: ServiceClient,
  userId: string,
  feature: FeatureId,
  ref: string,
): Promise<FeatureChargeResolution> {
  const price = FEATURE_PRICES_KRW[feature];

  if (await isFeatureUnlocked(service, userId, feature, ref)) {
    return { mode: 'unlocked', price, charged: false };
  }

  const { data, error } = await service.rpc('deduct_tokens_once', {
    uid: userId,
    delta: -price.token_cost,
    reason: `${feature}_use`,
    ref,
  });
  if (error) {
    // 잔액 부족(INSUFFICIENT_TOKENS, errcode P0001)만 현금 결제 요구로 본다.
    // DEDUCT_DELTA_MUST_BE_NEGATIVE 도 P0001 을 공유하므로 message 까지 2중 검사 (codex #6).
    // 일시적 DB 에러(deadlock 등)는 그대로 던져 라우트 catch 가 500 으로 매핑하게 한다.
    const e = error as { code?: string; message?: string };
    const isInsufficient = e.code === 'P0001' && /INSUFFICIENT_TOKENS/.test(e.message ?? '');
    if (isInsufficient) {
      return { mode: 'pay_required', price, charged: false };
    }
    throw error;
  }
  return { mode: 'free', price, charged: tokenRpcInserted(data) };
}
