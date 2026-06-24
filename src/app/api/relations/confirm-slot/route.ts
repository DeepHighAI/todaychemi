import { NextResponse } from 'next/server';

import { apiErrorResponse, paymentRequiredResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { materializeRelationSlot } from '@/lib/relations/materialize';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const ref = typeof json?.ref === 'string' ? json.ref : '';
  if (!ref.startsWith('relation_slot:')) {
    return apiErrorResponse('INVALID_BODY', '', 400);
  }
  const pendingId = ref.slice('relation_slot:'.length);
  if (!pendingId) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const service = createServiceRoleClient();
  const { data: pending, error: pendingError } = await service
    .from('pending_relation_registrations')
    .select('pending_id')
    .eq('pending_id', pendingId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (pendingError) return apiErrorResponse('INTERNAL_ERROR', '', 500);
  if (!pending) return apiErrorResponse('PENDING_NOT_FOUND', '', 404);

  let charged = false;
  try {
    const resolution = await resolveFeatureCharge(service, user.id, 'relation_slot', ref);
    charged = resolution.charged;

    if (resolution.mode === 'pay_required') {
      return paymentRequiredResponse(
        resolution.price.feature_id,
        ref,
        resolution.price.amount_krw,
      );
    }

    const relationId = await materializeRelationSlot(service, user.id, pendingId);
    if (!relationId) return apiErrorResponse('INTERNAL_ERROR', '', 500);
    return NextResponse.json({ ok: true, relation_id: relationId });
  } catch (err) {
    const safe = sanitizeErrorForLog(err);
    console.error('[POST /api/relations/confirm-slot] failed', { error: safe });
    if (charged) {
      const { error: refundErr } = await service.rpc('refund_tokens_once', {
        uid: user.id,
        delta: FEATURE_PRICES_KRW.relation_slot.token_cost,
        reason: 'relation_slot_refund',
        ref,
      });
      if (refundErr) {
        console.error('relation_slot_refund_failed', {
          user_id: user.id,
          pending_id: pendingId,
          original_error: safe,
          refund_error: sanitizeErrorForLog(refundErr.message),
        });
      }
    }
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
