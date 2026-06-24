import { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { previewFeatureCharge, toPreflightJson } from '@/lib/payments/feature-preflight';
import { FREE_RELATION_SLOTS } from '@/lib/payments/feature-prices';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { RelationCreateSchema, type RelationCreate } from '@/types/relation';

const OPEN_PENDING_CAP = 10;

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = RelationCreateSchema.safeParse(json);
  if (!parsed.success) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const service = createServiceRoleClient();

  const { count: relationCount, error: relationCountError } = await service
    .from('relations')
    .select('relation_id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (relationCountError) return apiErrorResponse('INTERNAL_ERROR', '', 500);
  if ((relationCount ?? 0) < FREE_RELATION_SLOTS) {
    return NextResponse.json({ mode: 'free', payment: null });
  }

  const { count: openPending, error: openPendingError } = await service
    .from('pending_relation_registrations')
    .select('pending_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('delivered_at', null);
  if (openPendingError) return apiErrorResponse('INTERNAL_ERROR', '', 500);
  if ((openPending ?? 0) >= OPEN_PENDING_CAP) {
    return apiErrorResponse('RATE_LIMITED', '', 429);
  }

  try {
    const pendingId = await getOrCreatePending(service, user.id, parsed.data);
    const ref = `relation_slot:${pendingId}`;
    const resolution = await previewFeatureCharge(service, user.id, 'relation_slot', ref);
    return NextResponse.json(toPreflightJson(resolution));
  } catch {
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

async function getOrCreatePending(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  draft: RelationCreate,
): Promise<string> {
  const { data: existing, error: existingError } = await service
    .from('pending_relation_registrations')
    .select('pending_id, draft')
    .eq('user_id', userId)
    .is('delivered_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  if (existingError) throw existingError;

  const match = ((existing ?? []) as Array<{ pending_id: string; draft: unknown }>)
    .find((row) => pendingDraftMatchesCurrent(row.draft, draft));
  if (match) return match.pending_id;

  const { data: stagedRows, error: stageError } = await service
    .from('pending_relation_registrations')
    .insert({ user_id: userId, draft })
    .select('pending_id');
  if (stageError) throw stageError;

  const pendingId = (stagedRows as Array<{ pending_id: string }>)?.[0]?.pending_id ?? '';
  if (!pendingId) throw new Error('PENDING_STAGE_FAILED');
  return pendingId;
}

function pendingDraftMatchesCurrent(pendingDraft: unknown, currentDraft: RelationCreate): boolean {
  if (typeof pendingDraft !== 'object' || pendingDraft === null) return false;
  const candidate = pendingDraft as Partial<RelationCreate>;
  return (
    candidate.nickname === currentDraft.nickname &&
    candidate.mode === currentDraft.mode &&
    candidate.gender === currentDraft.gender &&
    candidate.birth_date === currentDraft.birth_date &&
    candidate.birth_date_calendar === currentDraft.birth_date_calendar &&
    candidate.is_lunar_leap === currentDraft.is_lunar_leap &&
    candidate.birth_time_knowledge === currentDraft.birth_time_knowledge &&
    candidate.birth_time === currentDraft.birth_time &&
    candidate.birth_longitude === currentDraft.birth_longitude &&
    candidate.consent_confirmed === currentDraft.consent_confirmed &&
    candidate.is_primary === currentDraft.is_primary
  );
}
