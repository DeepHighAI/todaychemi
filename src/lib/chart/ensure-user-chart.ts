import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { DEFAULT_THEORY_PROFILE_VERSION, type ChartCore } from '@/types/chart';
import { fetchLatestUserChartForVersion } from '@/lib/chart/queries';
import { computeChart } from '@/lib/chart/compute';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';

export interface EnsuredUserChart {
  chart_core: ChartCore;
  chart_hash: string;
}

// theory_profile_version 범프(v1→v2) 후 기존 유저 차트 lazy 재계산 —
// lazy-relation-chart.ts 패턴 미러. 현재 버전 row 가 없으면 users 행 birth 데이터로
// computeChart → user_charts upsert (재온보딩 불필요). 실패 시 graceful null + 로깅.
// users 테이블에는 birth_longitude 가 없으므로(온보딩 미수집, ADR-021 Phase 2)
// 항상 서울 기본 경도로 계산된다.
export async function ensureUserChartRow(
  supabase: SupabaseClient<Database>,
  userId: string,
  kasiServiceKey: string,
  theoryProfileVersion = DEFAULT_THEORY_PROFILE_VERSION,
): Promise<EnsuredUserChart | null> {
  const { data: existing, error: existingError } = await fetchLatestUserChartForVersion(
    supabase,
    userId,
    theoryProfileVersion,
  );
  if (existingError) throw existingError;
  if (existing) {
    return {
      chart_core: existing.chart_core as unknown as ChartCore,
      chart_hash: existing.chart_hash,
    };
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('birth_date, birth_date_calendar, is_lunar_leap, birth_time_knowledge, birth_time, gender')
    .eq('user_id', userId)
    .maybeSingle();
  if (userError) throw userError;
  if (!userRow) {
    // 미온보딩 유저 — chart 없음이 정상
    return null;
  }

  type UserRow = {
    birth_date: string;
    birth_date_calendar: 'solar' | 'lunar';
    is_lunar_leap: boolean;
    birth_time_knowledge: 'exact' | 'approximate' | 'unknown';
    birth_time: string | null;
    gender: 'M' | 'F';
  };
  const u = userRow as unknown as UserRow;
  let computeResult: Awaited<ReturnType<typeof computeChart>>;
  try {
    computeResult = await computeChart(
      {
        entity_id: userId,
        birth_date: u.birth_date,
        birth_date_calendar: u.birth_date_calendar,
        is_lunar_leap: u.is_lunar_leap,
        birth_time_knowledge: u.birth_time_knowledge,
        birth_time: u.birth_time,
        gender: u.gender,
        theory_profile_version: theoryProfileVersion,
      },
      kasiServiceKey,
    );
  } catch (err) {
    console.error('[ensureUserChart] computeChart failed', {
      userId,
      error: sanitizeErrorForLog(err),
    });
    return null;
  }

  const { error: upsertError } = await supabase.from('user_charts').upsert(
    {
      user_id: userId,
      chart_hash: computeResult.chart_hash,
      chart_core: computeResult.chart_core as unknown as Json,
      theory_profile_version: theoryProfileVersion,
    },
    { onConflict: 'chart_hash' },
  );
  if (upsertError) throw upsertError;

  return {
    chart_core: computeResult.chart_core,
    chart_hash: computeResult.chart_hash,
  };
}
