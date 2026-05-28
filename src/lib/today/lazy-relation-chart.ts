import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { DEFAULT_THEORY_PROFILE_VERSION, type ChartCore } from '@/types/chart';
import { fetchLatestRelationChartForVersion } from '@/lib/chart/queries';
import { computeChart } from '@/lib/chart/compute';

// G2 / Phase 3 F3.1 — relation chart 미존재 시 KASI computeChart + relation_charts upsert.
// 순서:
//   1. 기존 chart 조회 → 있으면 그대로 반환 (canonical fast path)
//   2. 없으면 relations 테이블에서 birth 필드 fetch
//   3. KASI computeChart 호출 → relation_charts upsert → 새 chart 반환
//   4. relations row 가 없거나 KASI 실패 시 graceful null + console.error 로깅
// (Phase 3 F3.3 에서 error_events INSERT 추가 예정)
export async function ensureRelationChart(
  supabase: SupabaseClient<Database>,
  relationId: string,
  userId: string,
  kasiServiceKey: string,
): Promise<ChartCore | null> {
  // Step 1: 기존 chart 확인
  const { data: existing } = await fetchLatestRelationChartForVersion(
    supabase,
    relationId,
    DEFAULT_THEORY_PROFILE_VERSION,
  );
  if (existing) {
    return existing.chart_core as unknown as ChartCore;
  }

  // Step 2: relations row fetch (chart 미생성 인연의 birth 필드)
  const { data: relRow } = await supabase
    .from('relations')
    .select('birth_date, birth_date_calendar, is_lunar_leap, birth_time_knowledge, birth_time, gender')
    .eq('relation_id', relationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!relRow) {
    console.error('[ensureRelationChart] relation row not found', { relationId });
    return null;
  }

  // Step 3: computeChart + upsert
  type RelRow = {
    birth_date: string;
    birth_date_calendar: 'solar' | 'lunar';
    is_lunar_leap: boolean;
    birth_time_knowledge: 'exact' | 'approximate' | 'unknown';
    birth_time: string | null;
    gender: 'M' | 'F';
  };
  const r = relRow as unknown as RelRow;
  try {
    const computeResult = await computeChart(
      {
        entity_id: relationId,
        birth_date: r.birth_date,
        birth_date_calendar: r.birth_date_calendar,
        is_lunar_leap: r.is_lunar_leap,
        birth_time_knowledge: r.birth_time_knowledge,
        birth_time: r.birth_time,
        gender: r.gender,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      kasiServiceKey,
    );

    // ChartCore → Json 캐스트 (relations/route.ts:81 동일 패턴)
    const untypedDb = supabase as unknown as SupabaseClient;
    await untypedDb.from('relation_charts').upsert(
      {
        relation_id: relationId,
        user_id: userId,
        chart_hash: computeResult.chart_hash,
        chart_core: computeResult.chart_core,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      { onConflict: 'chart_hash' },
    );

    return computeResult.chart_core;
  } catch (err) {
    console.error('[ensureRelationChart] computeChart failed', { relationId, err });
    return null;
  }
}
