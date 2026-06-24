import { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { todayKST } from '@/lib/today/kst-date';

const AD_REWARD_AMOUNT = 5;
const AD_REWARD_DAILY_CAP = 3;

interface AdReward {
  awarded?: boolean;
  reason?: string;
  amount_awarded?: number;
  balance_after?: number | null;
  remaining?: number;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const today = todayKST();
    const { count, error } = await supabase
      .from('token_ledger')
      .select('ledger_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('reason', 'bonus')
      .like('reference_id', `ad_reward:${today}:%`);

    if (error) {
      return apiErrorResponse('INTERNAL_ERROR', error.message, 500);
    }

    const awardedToday = count ?? 0;
    return NextResponse.json({
      ok: true,
      reward: {
        amount_awarded: AD_REWARD_AMOUNT,
        daily_cap: AD_REWARD_DAILY_CAP,
        awarded_today: awardedToday,
        remaining: Math.max(0, AD_REWARD_DAILY_CAP - awardedToday),
      },
    });
  } catch (err) {
    console.error('[/api/rewards/ad GET]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

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
    const { data: reward, error } = await service.rpc('award_rewarded_ad_talisman', {
      uid: user.id,
    });

    if (error) {
      return apiErrorResponse('INTERNAL_ERROR', error.message, 500);
    }

    return NextResponse.json({ ok: true, reward: normalizeReward(reward) });
  } catch (err) {
    console.error('[/api/rewards/ad POST]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

function normalizeReward(reward: unknown): AdReward {
  if (!reward || typeof reward !== 'object') return {};
  return reward as AdReward;
}
