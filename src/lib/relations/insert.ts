import type { SupabaseClient } from '@supabase/supabase-js';

import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import type { RelationCreate } from '@/types/relation';
import { computeChart } from '@/lib/chart/compute';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';

// INSERT 실패를 DB 에러 코드와 함께 노출 — 머티리얼라이저가 23505(pk 중복)를
// 크래시 복구 재시도의 성공으로 판별하는 데 사용한다.
export class RelationInsertError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = 'RelationInsertError';
  }
}

// 인연 INSERT + eager 차트 컴퓨트 — 무료 등록 경로(/api/relations)와
// 유료 슬롯 머티리얼라이즈(materializeRelationSlot)가 공유한다.
// INSERT 실패는 throw — 호출부가 500 응답·부적 환불 등 보상 처리를 담당.
// 차트 컴퓨트·업서트 실패는 best-effort: relation 등록은 유지 (chartPending UX).
// relationId 를 명시하면 pk 고정 INSERT — 클레임에 기록된 uuid 로 멱등 재시도 가능.
export async function insertRelationAndComputeChart(
  db: SupabaseClient,
  userId: string,
  draft: RelationCreate,
  relationIdOverride?: string,
): Promise<string> {
  const { data: insertedRows, error } = await db
    .from('relations')
    .insert({
      ...(relationIdOverride ? { relation_id: relationIdOverride } : {}),
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
    throw new RelationInsertError(`relations insert failed: ${error.code}`, error.code ?? null);
  }

  const relationId = (insertedRows as Array<{ relation_id: string }>)?.[0]?.relation_id ?? '';
  if (!relationId) {
    throw new Error('relations insert returned no relation_id');
  }

  await computeAndUpsertChart(db, userId, relationId, draft);
  return relationId;
}

// 무료 인연 등록 — count 와 INSERT 를 단일 RPC(원자적 INSERT...SELECT...WHERE count<N)로.
// TOCTOU 차단 (ADR-039 §9): 동시 요청도 row-level 직렬화로 정확히 한도까지만 통과.
// 반환: relation_id(등록 성공) | null(슬롯 초과 → 호출부가 유료 경로로 분기).
// chart compute 는 RPC 밖 best-effort (KASI 외부 호출, chartPending UX).
export async function insertFreeRelationIfUnderCap(
  db: SupabaseClient,
  userId: string,
  draft: RelationCreate,
  freeSlots: number,
): Promise<string | null> {
  const { data, error } = await db.rpc('insert_relation_if_under_free_cap', {
    p_user_id: userId,
    p_draft: draft as unknown as Record<string, unknown>,
    p_free_slots: freeSlots,
  });
  if (error) {
    throw new RelationInsertError(
      `insert_relation_if_under_free_cap failed: ${error.code}`,
      error.code ?? null,
    );
  }
  const relationId = (data as string | null) ?? null;
  if (!relationId) return null; // 슬롯 초과

  await computeAndUpsertChart(db, userId, relationId, draft);
  return relationId;
}

// 차트 컴퓨트 + relation_charts upsert — best-effort. 실패해도 relation 등록은 유지(chartPending UX).
// 무료 RPC 경로와 머티리얼라이즈/직접 INSERT 경로가 공유.
async function computeAndUpsertChart(
  db: SupabaseClient,
  userId: string,
  relationId: string,
  draft: RelationCreate,
): Promise<void> {
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
}
