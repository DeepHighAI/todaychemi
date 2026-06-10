import type { SupabaseClient } from '@supabase/supabase-js';

import { RelationCreateSchema } from '@/types/relation';
import {
  insertRelationAndComputeChart,
  RelationInsertError,
} from '@/lib/relations/insert';

// 유료 슬롯 인연 머티리얼라이즈 (ADR-039 Amended — 모델 C: 선생성 후 결제).
//
// 클레임-퍼스트 + 클레임 시점 relation_id(클라이언트 uuid) 기록:
//   1) materialized_at + relation_id 를 한 UPDATE 로 원자 기록 (materialized_at IS NULL 가드)
//   2) 승자만 기록된 uuid 로 pk 고정 INSERT — 클레임↔INSERT 사이 크래시도 재진입 시
//      "기록 id 가 relations 에 없음" 으로 판별되어 멱등 재INSERT 로 복구된다.
//   3) FK on delete set null 덕분에 relation_id NULL + materialized_at 有 =
//      "머티리얼라이즈 후 유저가 삭제" 로 유일하게 해석 — 재생성 금지(슬롯 소비 완료).
//
// service-role 클라이언트 전제 — RLS 우회되므로 모든 조회·갱신에 user_id 를 명시 핀.
// 반환: relation_id. 삭제로 소비 완료된 슬롯은 null.
export async function materializeRelationSlot(
  service: SupabaseClient,
  userId: string,
  pendingId: string,
): Promise<string | null> {
  const pending = await fetchPending(service, userId, pendingId);

  if (pending.materialized_at) {
    return resolveMaterialized(service, userId, pending);
  }

  // 클레임 — relation_id 를 지금 확정해 기록한다 (크래시 복구의 열쇠)
  const newId = crypto.randomUUID();
  const { data: claimed, error: claimError } = await service
    .from('pending_relation_registrations')
    .update({ materialized_at: new Date().toISOString(), relation_id: newId })
    .eq('pending_id', pendingId)
    .eq('user_id', userId)
    .is('materialized_at', null)
    .select('pending_id');

  if (claimError) {
    throw new Error(`pending claim failed: ${claimError.code}`);
  }

  if (!claimed || claimed.length === 0) {
    // 동시 race 패배 — 승자의 기록으로 수렴
    const winner = await fetchPending(service, userId, pendingId);
    if (!winner.materialized_at) {
      // 승자가 INSERT 실패로 un-claim — 보상은 그쪽 시도가 처리, 여기선 중복 과금 방지 위해 중단
      throw new Error('MATERIALIZE_RACE_UNRESOLVED');
    }
    return resolveMaterialized(service, userId, winner);
  }

  try {
    await insertRelationAndComputeChart(service, userId, parseDraft(pending.draft), newId);
  } catch (err) {
    if (err instanceof RelationInsertError && err.code === '23505') {
      // 크래시 복구 중복 INSERT — 행이 이미 존재하므로 성공 취급
      return newId;
    }
    // un-claim 전 가드: 동시 수렴 시도(race 패자)가 같은 newId 로 이미 INSERT 를
    // 성공시킨 뒤 이쪽 INSERT 만 일시 오류로 실패했을 수 있다. 행이 존재하면
    // un-claim 하지 않는다 — 클레임을 되돌리면 다음 시도가 새 id 로 이중 생성한다.
    const { data: delivered } = await service
      .from('relations')
      .select('relation_id')
      .eq('relation_id', newId)
      .eq('user_id', userId)
      .maybeSingle();
    if (delivered) return newId;

    // un-claim — 자기 클레임(relation_id=newId)만 되돌려 재시도 가능 상태로 복원
    await service
      .from('pending_relation_registrations')
      .update({ materialized_at: null, relation_id: null })
      .eq('pending_id', pendingId)
      .eq('relation_id', newId)
      .select('pending_id');
    throw err;
  }

  return newId;
}

type PendingRow = {
  pending_id: string;
  user_id: string;
  draft: unknown;
  relation_id: string | null;
  materialized_at: string | null;
};

async function fetchPending(
  service: SupabaseClient,
  userId: string,
  pendingId: string,
): Promise<PendingRow> {
  const { data, error } = await service
    .from('pending_relation_registrations')
    .select('pending_id, user_id, draft, relation_id, materialized_at')
    .eq('pending_id', pendingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`pending select failed: ${error.code}`);
  }
  if (!data || (data as PendingRow).user_id !== userId) {
    throw new Error('PENDING_NOT_FOUND');
  }
  return data as PendingRow;
}

// 머티리얼라이즈 기록이 있는 pending 의 수렴 처리:
// relation_id NULL = 삭제로 소비 완료 → null. 행 부재 = 크래시 복구 재INSERT.
async function resolveMaterialized(
  service: SupabaseClient,
  userId: string,
  pending: PendingRow,
): Promise<string | null> {
  if (!pending.relation_id) return null;

  const { data: existing, error } = await service
    .from('relations')
    .select('relation_id')
    .eq('relation_id', pending.relation_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`relations select failed: ${error.code}`);
  }
  if (existing) return pending.relation_id;

  try {
    await insertRelationAndComputeChart(
      service,
      userId,
      parseDraft(pending.draft),
      pending.relation_id,
    );
  } catch (err) {
    if (err instanceof RelationInsertError && err.code === '23505') {
      return pending.relation_id;
    }
    throw err;
  }
  return pending.relation_id;
}

function parseDraft(draft: unknown) {
  const parsed = RelationCreateSchema.safeParse(draft);
  if (!parsed.success) {
    // 스테이징 시 Zod 검증을 통과한 draft 만 저장되므로 정상 흐름에선 도달 불가
    throw new Error('PENDING_DRAFT_INVALID');
  }
  return parsed.data;
}
