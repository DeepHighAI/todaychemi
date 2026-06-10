import type { SupabaseClient } from '@supabase/supabase-js';

import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import type { RelationCreate } from '@/types/relation';
import { computeChart } from '@/lib/chart/compute';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';

// 인연 INSERT + eager 차트 컴퓨트 — 무료 등록 경로(/api/relations)와
// 유료 슬롯 머티리얼라이즈(materializeRelationSlot)가 공유한다.
// INSERT 실패는 throw — 호출부가 500 응답·부적 환불 등 보상 처리를 담당.
// 차트 컴퓨트·업서트 실패는 best-effort: relation 등록은 유지 (chartPending UX).
export async function insertRelationAndComputeChart(
  db: SupabaseClient,
  userId: string,
  draft: RelationCreate,
): Promise<string> {
  const { data: insertedRows, error } = await db
    .from('relations')
    .insert({
      user_id: userId,
      nickname: draft.nickname,
      mode: draft.mode,
      gender: draft.gender,
      birth_date: draft.birth_date,
      birth_date_calendar: draft.birth_date_calendar,
      is_lunar_leap: draft.is_lunar_leap,
      birth_time_knowledge: draft.birth_time_knowledge,
      birth_time: draft.birth_time,
      birth_longitude: draft.birth_longitude ?? null,
      consent_confirmed: draft.consent_confirmed,
      is_primary: draft.is_primary,
    })
    .select('relation_id');

  if (error) {
    throw new Error(`relations insert failed: ${error.code}`);
  }

  const relationId = (insertedRows as Array<{ relation_id: string }>)?.[0]?.relation_id ?? '';
  if (!relationId) {
    throw new Error('relations insert returned no relation_id');
  }

  try {
    const computeResult = await computeChart(
      {
        entity_id: relationId,
        birth_date: draft.birth_date,
        birth_date_calendar: draft.birth_date_calendar,
        is_lunar_leap: draft.is_lunar_leap,
        birth_time_knowledge: draft.birth_time_knowledge,
        birth_time: draft.birth_time,
        gender: draft.gender,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      process.env.KASI_SERVICE_KEY!,
    );

    const { error: chartError } = await db.from('relation_charts').upsert(
      {
        relation_id: relationId,
        user_id: userId,
        chart_hash: computeResult.chart_hash,
        chart_core: computeResult.chart_core,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      { onConflict: 'chart_hash' },
    );
    if (chartError) {
      console.error('[relations] relation_charts upsert failed', {
        error_code: chartError.code,
        error: sanitizeErrorForLog(new Error(chartError.message)),
      });
    }
  } catch (err) {
    console.error('[relations] computeChart failed', { error: sanitizeErrorForLog(err) });
    // KASI 실패 → relation 등록은 완료, hapcard에서 chartPending으로 표시
  }

  return relationId;
}
