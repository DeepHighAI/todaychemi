import { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const FREE_TALISMAN_POLICY_EFFECTIVE_AT = '2026-05-25T00:00:00+09:00';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const service = createServiceRoleClient();
    const { data: reward, error } = await service.rpc('award_free_talisman_session_rewards', {
      uid: user.id,
      p_auth_created_at: user.created_at ?? null,
      p_policy_effective_at: FREE_TALISMAN_POLICY_EFFECTIVE_AT,
    });

    if (error) {
      return apiErrorResponse('INTERNAL_ERROR', error.message, 500);
    }

    return NextResponse.json({ ok: true, reward });
  } catch (err) {
    console.error('[/api/rewards/session]', err);
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
