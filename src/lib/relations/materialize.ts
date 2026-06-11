import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import { RelationCreateSchema } from '@/types/relation';
import {
  insertRelationAndComputeChart,
  RelationInsertError,
} from '@/lib/relations/insert';

type ServiceClient = SupabaseClient<Database>;

// 유료 슬롯 인연 머티리얼라이즈 (ADR-039 Amended §9 — 모델 C: 선생성 후 결제).
//
// 상태 분리 (delivered_at 도입, /qa 2026-06-10 FK 충돌 P0 수정):
//   materialized_at — 클레임됨(전달 시도 진입). relation_id 는 건드리지 않는다.
//   delivered_at    — relations INSERT 완료. 이때 relation_id 를 기록(FK 충족).
//   relation_id     = pending_id (deterministic). 멱등 재INSERT 가 같은 pk 로 충돌(23505)해 안전.
//
// 클레임 시 relation_id 를 기록하면 FK(relation_id → relations) 위반(23503)이므로,
// relation_id 는 반드시 INSERT 후에만 쓴다. 상태 판별:
//   delivered_at 有 + relation_id 有  = 전달 완료 → 기존 id 반환.
//   delivered_at 有 + relation_id NULL = 삭제 소비(FK on delete set null) → null(재생성 금지).
//   delivered_at NULL                  = 미전달(첫 진입 또는 크래시) → deterministic 재INSERT.
//
// service-role 클라이언트 전제 — RLS 우회되므로 모든 조회·갱신에 user_id 를 명시 핀.
// 반환: relation_id. 삭제로 소비 완료된 슬롯은 null.
export async function materializeRelationSlot(
  service: ServiceClient,
  userId: string,
  pendingId: string,
): Promise<string | null> {
  const pending = await fetchPending(service, userId, pendingId);

  // 전달 이력 있음 → 소비 여부로 분기 (INSERT 불필요)
  if (pending.delivered_at) {
    return pending.relation_id; // 有=relationId, NULL=삭제 소비
  }

  // relation_id = pending_id (deterministic) — 멱등 재INSERT 의 열쇠.
  const relationId = pendingId;

  // 클레임 — materialized_at 만 설정 (FK 컬럼 relation_id 는 전달 마킹에서 기록).
  // 이미 클레임된(race 패배·크래시 재진입) 경우 0행이지만, 아래 deterministic INSERT 가
  // 멱등이라 그대로 진행해 수렴한다.
  if (!pending.materialized_at) {
    const { error: claimError } = await service
      .from('pending_relation_registrations')
      .update({ materialized_at: new Date().toISOString() })
      .eq('pending_id', pendingId)
      .eq('user_id', userId)
      .is('materialized_at', null)
      .select('pending_id');
    if (claimError) {
      throw new Error(`pending claim failed: ${claimError.code ?? 'unknown'}`);
    }
  }

  // 전달 — INSERT(relation_id=pending_id). 23505(동시/재시도 중복)는 멱등 성공으로 본다.
  try {
    await insertRelationAndComputeChart(service, userId, parseDraft(pending.draft), relationId);
  } catch (err) {
    if (!(err instanceof RelationInsertError && err.code === '23505')) {
      throw err; // 진짜 실패 → 호출부가 환불(charged 플래그)
    }
  }

  // 전달 마킹 — relation_id(방금 INSERT 됐으므로 FK 충족) + delivered_at.
  // 실패해도 throw 금지: 인연은 이미 INSERT 됐으므로 throw 하면 호출부 catch 가
  // 환불을 쏴 "전달됐는데 환불"(이중 보상)이 된다. 관측(log+Sentry)만 남긴다 —
  // 현금 경로는 recoverPaidPendings(delivered_at IS NULL)가 다음 POST 에서 재마킹해 수렴.
  const { error: deliverMarkError } = await service
    .from('pending_relation_registrations')
    .update({ relation_id: relationId, delivered_at: new Date().toISOString() })
    .eq('pending_id', pendingId)
    .eq('user_id', userId)
    .select('pending_id');
  if (deliverMarkError) {
    console.error('relation_slot_deliver_mark_failed', {
      user_id: userId,
      pending_id: pendingId,
      error_code: deliverMarkError.code ?? 'unknown',
    });
    Sentry.captureException(new Error('relation_slot deliver mark failed'), {
      tags: { area: 'payments', payment_step: 'relation_slot_deliver_mark' },
    });
  }

  return relationId;
}

type PendingRow = {
  pending_id: string;
  user_id: string;
  draft: unknown;
  relation_id: string | null;
  materialized_at: string | null;
  delivered_at: string | null;
};

async function fetchPending(
  service: ServiceClient,
  userId: string,
  pendingId: string,
): Promise<PendingRow> {
  const { data, error } = await service
    .from('pending_relation_registrations')
    .select('pending_id, user_id, draft, relation_id, materialized_at, delivered_at')
    .eq('pending_id', pendingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`pending select failed: ${error.code ?? 'unknown'}`);
  }
  if (!data || (data as PendingRow).user_id !== userId) {
    throw new Error('PENDING_NOT_FOUND');
  }
  return data as PendingRow;
}

function parseDraft(draft: unknown) {
  const parsed = RelationCreateSchema.safeParse(draft);
  if (!parsed.success) {
    // 스테이징 시 Zod 검증을 통과한 draft 만 저장되므로 정상 흐름에선 도달 불가
    throw new Error('PENDING_DRAFT_INVALID');
  }
  return parsed.data;
}
