import type { SupabaseClient } from '@supabase/supabase-js';

import type { FeatureId } from './feature-prices';

// whatif_results 가 아직 생성 타입(database.types.ts)에 없어 untyped SupabaseClient 사용
// (src/lib/whatif/builder.ts 와 동일 우회). 여기서는 존재 검증만 하므로 행 타입 손실 무방.
type ServiceClient = SupabaseClient;

const REPLAY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// pay-per-use 결제 시작 전 ref 소유 검증 (ADR-039, codex #4).
// init 이 임의 ref 로 미존재 결과를 결제하는 self-harm 을 차단 — 사용자가 실제로
// 선생성된 결과 행을 소유할 때만 결제를 허용한다.
//   hapcard/whatif — ref=cache_key 가 결과 테이블에 user_id 와 함께 존재.
//   replay         — ref=replay:{hapcard_id}:{jinjin_date} 를 파싱해 hapcard_replays 조회.
//   relation_slot  — ref=relation_slot:{pending_id} 를 파싱해 스테이징 행 소유 확인.
export async function verifyFeatureRefOwnership(
  service: ServiceClient,
  userId: string,
  feature: FeatureId,
  ref: string,
): Promise<boolean> {
  if (feature === 'hapcard') {
    const res = await service
      .from('hapcards')
      .select('hapcard_id')
      .eq('cache_key', ref)
      .eq('user_id', userId)
      .maybeSingle();
    return Boolean(res.data);
  }

  if (feature === 'whatif') {
    const res = await service
      .from('whatif_results')
      .select('whatif_id')
      .eq('cache_key', ref)
      .eq('user_id', userId)
      .maybeSingle();
    return Boolean(res.data);
  }

  if (feature === 'relation_slot') {
    // materialized_at 필터 금지 — 이미 결제·머티리얼라이즈된 ref 의 init 재오픈
    // (unlocked 단락 경로)도 소유 검증을 통과해야 한다.
    const slotParts = ref.split(':');
    if (slotParts.length !== 2 || slotParts[0] !== 'relation_slot' || !slotParts[1]) {
      return false;
    }
    const res = await service
      .from('pending_relation_registrations')
      .select('pending_id')
      .eq('pending_id', slotParts[1])
      .eq('user_id', userId)
      .maybeSingle();
    return Boolean(res.data);
  }

  // replay — uuid 와 YYYY-MM-DD 모두 콜론을 포함하지 않아 split(':') 가 명확.
  const parts = ref.split(':');
  if (parts.length !== 3 || parts[0] !== 'replay' || !parts[1] || !REPLAY_DATE_RE.test(parts[2])) {
    return false;
  }
  const res = await service
    .from('hapcard_replays')
    .select('replay_id')
    .eq('hapcard_id', parts[1])
    .eq('jinjin_date', parts[2])
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(res.data);
}
