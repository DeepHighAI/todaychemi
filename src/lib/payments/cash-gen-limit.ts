import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import { todayKST } from '@/lib/today/kst-date';

type ServiceClient = SupabaseClient<Database>;

// whatif_results 는 stale 한 database.types.ts 에 아직 없음 — whatif 라우트(route.ts:82)와 동일하게
// 느슨한 SupabaseClient 로 캐스트해 카운트 쿼리한다. Phase 6 regen 시 정식 타입 복원.

// 모델 C 의 대가(선생성 LLM 비용) 완충. 잔액 부족(pay_required) 경로에서만 호출한다.
// 미결제 선생성 = 오늘 생성된 결과 행 중 부적 차감도 현금 확정도 없는 것.
//   unpaid = generatedToday − freeUseToday − confirmedToday  (정산된 생성은 한도에서 제외)
export const DEFAULT_CASH_GEN_DAILY_LIMIT = 5;

const FREE_USE_REASONS = ['hapcard_use', 'whatif_use', 'replay_use'];

export interface CashGenLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

function resolveLimit(optsLimit?: number): number {
  if (optsLimit != null) return optsLimit;
  const env = process.env.CASH_GEN_DAILY_LIMIT;
  if (env != null && env.trim() !== '') {
    const n = Number(env);
    if (Number.isFinite(n)) return n;
  }
  return DEFAULT_CASH_GEN_DAILY_LIMIT;
}

export async function checkCashGenLimit(
  service: ServiceClient,
  userId: string,
  opts?: { limit?: number },
): Promise<CashGenLimitResult> {
  const limit = resolveLimit(opts?.limit);
  const dayStart = `${todayKST()}T00:00:00+09:00`;

  // 오늘 생성된 결과 행 (3개 피처 테이블) — 테이블 리터럴로 호출(유니온 타입 회피).
  const [hapcardRes, whatifRes, replayRes] = await Promise.all([
    service
      .from('hapcards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayStart),
    (service as unknown as SupabaseClient)
      .from('whatif_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayStart),
    service
      .from('hapcard_replays')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayStart),
  ]);
  const generated =
    (hapcardRes.count ?? 0) + (whatifRes.count ?? 0) + (replayRes.count ?? 0);

  // 오늘 무료 부적 차감 ({feature}_use).
  const { count: freeUseCount } = await service
    .from('token_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('reason', FREE_USE_REASONS)
    .gte('created_at', dayStart);
  const freeUse = freeUseCount ?? 0;

  // 오늘 확정된 피처 현금결제.
  const { count: confirmedCount } = await service
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('charge_type', 'feature_use')
    .eq('status', 'confirmed')
    .gte('created_at', dayStart);
  const confirmed = confirmedCount ?? 0;

  const unpaid = Math.max(0, generated - freeUse - confirmed);
  return { allowed: unpaid < limit, count: unpaid, limit };
}
