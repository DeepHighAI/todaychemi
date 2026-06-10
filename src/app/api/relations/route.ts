import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { apiErrorResponse, paymentRequiredResponse } from '@/lib/errors/route-response';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  RelationCreateSchema,
  type RelationCreate,
  type FeedListItem,
} from '@/types/relation';
import { insertRelationAndComputeChart } from '@/lib/relations/insert';
import { materializeRelationSlot } from '@/lib/relations/materialize';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { FEATURE_PRICES_KRW, FREE_RELATION_SLOTS } from '@/lib/payments/feature-prices';
import { sanitizeErrorForLog, sanitizeErrorForReporting } from '@/lib/errors/sanitize-log';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('relations')
    .select('relation_id, nickname, mode, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  const items = (data ?? []) as FeedListItem[];
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = RelationCreateSchema.safeParse(json);
  if (!parsed.success) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const db = supabase as unknown as SupabaseClient;
  const service = createServiceRoleClient();

  // A1 — 결제 confirmed 인데 머티리얼라이즈가 누락된 고아 pending 을 먼저 전달(재과금 방지).
  // count 게이트보다 먼저: 유저가 인연을 지워 무료 구간(<2)으로 내려가도 paid 고아는
  // 반드시 전달돼야 한다(돈 받은 건 반드시 제공). 복구된 인연은 이어지는 count 에 반영된다.
  await recoverPaidPendings(service, user.id);

  // 슬롯 게이트 (ADR-039 Amended, 모델 B) — 현재 보유 행 수 기준. 판정 불가 시 등록 금지.
  const { count, error: countError } = await db
    .from('relations')
    .select('relation_id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (countError) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  if ((count ?? 0) < FREE_RELATION_SLOTS) {
    // 무료 경로 — 기존 동작 불변 (INSERT throw / 차트 best-effort 는 헬퍼 책임)
    let relationId: string;
    try {
      relationId = await insertRelationAndComputeChart(db, user.id, parsed.data);
    } catch {
      return apiErrorResponse('INTERNAL_ERROR', '', 500);
    }
    return NextResponse.json({ ok: true, relation_id: relationId });
  }

  return handlePaidSlot(service, user.id, parsed.data);
}

// 유료 슬롯 경로 (3번째 인연부터) — draft 스테이징 후 하이브리드 과금.
// LLM 선생성 비용이 없으므로 checkCashGenLimit 은 적용하지 않는다 (ADR-039 Amended).
async function handlePaidSlot(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  draft: RelationCreate,
) {
  // 초안 스테이징 — 현금 결제(비동기 토스 리다이렉트) 동안 draft 를 서버에 보존
  const { data: stagedRows, error: stageError } = await service
    .from('pending_relation_registrations')
    .insert({ user_id: userId, draft })
    .select('pending_id');
  if (stageError) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  const pendingId = (stagedRows as Array<{ pending_id: string }>)?.[0]?.pending_id ?? '';
  if (!pendingId) return apiErrorResponse('INTERNAL_ERROR', '', 500);
  const ref = `relation_slot:${pendingId}`;

  let charged = false;
  try {
    const resolution = await resolveFeatureCharge(service, userId, 'relation_slot', ref);
    charged = resolution.charged;

    if (resolution.mode === 'pay_required') {
      // 잔액 부족 — pending 은 유지(현금 흐름이 사용), 본문 없이 402 로 결제 요구
      return paymentRequiredResponse(
        resolution.price.feature_id,
        ref,
        resolution.price.amount_krw,
      );
    }

    // free | unlocked — 즉시 머티리얼라이즈. 신규 pending 이므로 null(삭제 소비) 도달 불가.
    const relationId = await materializeRelationSlot(service, userId, pendingId);
    if (!relationId) return apiErrorResponse('INTERNAL_ERROR', '', 500);
    return NextResponse.json({ ok: true, relation_id: relationId });
  } catch (err) {
    const safe = sanitizeErrorForLog(err);
    console.error('[POST /api/relations] paid slot failed', { error: safe });
    if (charged) {
      const { error: refundErr } = await service.rpc('refund_tokens_once', {
        uid: userId,
        delta: FEATURE_PRICES_KRW.relation_slot.token_cost,
        reason: 'relation_slot_refund',
        ref,
      });
      if (refundErr) {
        console.error('relation_slot_refund_failed', {
          user_id: userId,
          pending_id: pendingId,
          original_error: safe,
          refund_error: sanitizeErrorForLog(refundErr.message),
        });
      }
    }
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

// A1 lazy recovery — confirm 후 머티리얼라이즈가 실패한 고아(돈은 받고 인연 미생성)를
// 다음 유료 등록 시도 때 전달한다. 판정 기준은 결제 row confirmed 만 사용:
// 환불된 토큰경로 pending 은 ledger 기준(isFeatureUnlocked)으로는 true 라 무료 슬롯이 돼버린다.
async function recoverPaidPendings(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
) {
  try {
    const { data: paid, error: paidError } = await service
      .from('payments')
      .select('feature_ref')
      .eq('user_id', userId)
      .eq('charge_type', 'feature_use')
      .eq('feature_id', 'relation_slot')
      .eq('status', 'confirmed');
    if (paidError) throw paidError;

    // confirmed 결제 ref 에서 직접 pending_id 추출 — pending 테이블 무순서 스캔이
    // 아니라 결제 기준이라 고아가 "스캔 범위 밖"으로 영구 누락되지 않는다.
    const paidPendingIds = (paid ?? [])
      .map((row: { feature_ref: string | null }) => row.feature_ref)
      .filter((ref): ref is string => Boolean(ref?.startsWith('relation_slot:')))
      .map((ref) => ref.slice('relation_slot:'.length))
      .filter(Boolean);
    if (paidPendingIds.length === 0) return;

    // 결제된 것 중 아직 머티리얼라이즈 안 된 것만 조회 (대부분 이미 처리 → 빈 결과).
    const { data: pendings, error: pendingsError } = await service
      .from('pending_relation_registrations')
      .select('pending_id')
      .eq('user_id', userId)
      .in('pending_id', paidPendingIds)
      .is('materialized_at', null);
    if (pendingsError) throw pendingsError;

    for (const row of (pendings ?? []) as Array<{ pending_id: string }>) {
      try {
        await materializeRelationSlot(service, userId, row.pending_id);
      } catch (itemErr) {
        // 한 고아의 실패가 나머지 paid 고아 복구를 막지 않게 격리한다.
        console.error('relation_slot_recovery_item_failed', {
          user_id: userId,
          pending_id: row.pending_id,
          error: sanitizeErrorForLog(itemErr),
        });
        Sentry.captureException(
          itemErr instanceof Error
            ? sanitizeErrorForReporting(itemErr)
            : new Error('relation_slot recovery item failed'),
          { tags: { area: 'payments', payment_step: 'relation_slot_recovery' } },
        );
      }
    }
  } catch (err) {
    // 복구 실패가 신규 등록을 막으면 안 된다 — 로깅 후 계속 (다음 시도에서 재복구).
    // 돈 받고 미전달 상태이므로 console 외에 Sentry 로도 알린다.
    console.error('relation_slot_recovery_failed', {
      user_id: userId,
      error: sanitizeErrorForLog(err),
    });
    Sentry.captureException(
      err instanceof Error ? sanitizeErrorForReporting(err) : new Error('relation_slot recovery failed'),
      { tags: { area: 'payments', payment_step: 'relation_slot_recovery' } },
    );
  }
}
