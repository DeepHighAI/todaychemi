import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { Mode } from '@/types/mode';
import type { TodayRelationMeta } from '@/lib/today/builder';

// G2 / Phase 3 C7 — 오늘카드 인연 자동 선택.
// 우선순위:
//   1. preferredRelationId 가 사용자 소유 인연이면 → 그 인연 반환
//   2. 사용자의 최근 등록(created_at desc) 인연 1건 → 그 인연 반환
//   3. 인연 0건 → null
// (향후: "최근 본 인연" 추적 시 last_viewed_at 컬럼 활용 — 현재는 created_at 기반)
export async function pickTodayRelation(
  supabase: SupabaseClient<Database>,
  userId: string,
  preferredRelationId: string | undefined,
): Promise<TodayRelationMeta | null> {
  if (preferredRelationId) {
    const { data } = await supabase
      .from('relations')
      .select('relation_id, nickname, mode')
      .eq('relation_id', preferredRelationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      return {
        id: (data as { relation_id: string }).relation_id,
        nickname: (data as { nickname: string }).nickname,
        mode: (data as { mode: Mode }).mode,
      };
    }
    // preferred 가 사용자 소유 아니면 fallback (최근 인연 자동 선택)
  }

  const { data } = await supabase
    .from('relations')
    .select('relation_id, nickname, mode')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: (data as { relation_id: string }).relation_id,
    nickname: (data as { nickname: string }).nickname,
    mode: (data as { mode: Mode }).mode,
  };
}
