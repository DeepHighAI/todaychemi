import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

import { FEATURE_PRICES_KRW, type FeatureId, type FeaturePrice } from './feature-prices';
import { isFeatureUnlocked } from './feature-unlock';

type ServiceClient = SupabaseClient<Database>;

export type FeaturePreflightMode = 'unlocked' | 'token_required' | 'pay_required';

export interface FeaturePreflightResolution {
  mode: FeaturePreflightMode;
  feature: FeatureId;
  ref: string;
  price: FeaturePrice;
  token_cost: number;
  amount_krw: number;
  balance: number;
  shortage: number;
}

async function getLatestTokenBalance(service: ServiceClient, userId: string): Promise<number> {
  const { data, error } = await service
    .from('token_ledger')
    .select('balance_after')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.balance_after === 'number' ? data.balance_after : 0;
}

export async function previewFeatureCharge(
  service: ServiceClient,
  userId: string,
  feature: FeatureId,
  ref: string,
): Promise<FeaturePreflightResolution> {
  const price = FEATURE_PRICES_KRW[feature];
  const base = {
    feature,
    ref,
    price,
    token_cost: price.token_cost,
    amount_krw: price.amount_krw,
  };

  if (await isFeatureUnlocked(service, userId, feature, ref)) {
    return { ...base, mode: 'unlocked', balance: 0, shortage: 0 };
  }

  const balance = await getLatestTokenBalance(service, userId);
  const shortage = Math.max(0, price.token_cost - balance);

  if (shortage === 0) {
    return { ...base, mode: 'token_required', balance, shortage: 0 };
  }

  return { ...base, mode: 'pay_required', balance, shortage };
}

export function toPreflightJson(resolution: FeaturePreflightResolution) {
  return {
    mode: resolution.mode,
    feature: resolution.feature,
    ref: resolution.ref,
    token_cost: resolution.token_cost,
    amount_krw: resolution.amount_krw,
    balance: resolution.balance,
    shortage: resolution.shortage,
    payment: resolution.mode === 'pay_required'
      ? {
          feature: resolution.feature,
          ref: resolution.ref,
          amount_krw: resolution.amount_krw,
        }
      : null,
  };
}
