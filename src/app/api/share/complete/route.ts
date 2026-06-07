import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { ShareChannelSchema } from '@/lib/share/schema';
import { createClient } from '@/lib/supabase/server';

const ShareCompleteRequestSchema = z
  .object({
    share_id: z.string().uuid(),
    channel: ShareChannelSchema,
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = ShareCompleteRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return apiErrorResponse('INVALID_BODY', 'invalid share completion request', 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const { data: shareRow, error: shareError } = await supabase
      .from('hapcard_shares')
      .select('share_id,user_id')
      .eq('share_id', body.data.share_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (shareError) {
      return apiErrorResponse('INTERNAL_ERROR', shareError.message, 500);
    }
    if (!shareRow) {
      return apiErrorResponse('SHARE_NOT_FOUND', '', 404);
    }

    return NextResponse.json({
      ok: true,
      reward: {
        awarded: false,
        reason: body.data.channel === 'kakao' ? 'WEBHOOK_REQUIRED' : 'UNVERIFIED_CHANNEL',
      },
    });
  } catch (err) {
    console.error('[/api/share/complete]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
