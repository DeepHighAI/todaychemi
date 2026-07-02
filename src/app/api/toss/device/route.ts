/**
 * POST /api/toss/device
 *
 * Apps in Toss 기기 보조 식별자 매핑.
 * 클라이언트 raw deviceId 는 요청 처리 중 HMAC 해시로만 변환하고 DB/로그/응답에 남기지 않는다.
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { hashTossDeviceId } from '@/lib/toss/device';

const DeviceBodySchema = z.object({
  deviceId: z.string().trim().min(1).max(512),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = DeviceBodySchema.safeParse(json);
    if (!parsed.success) {
      return apiErrorResponse('INVALID_BODY', 'deviceId 가 필요합니다', 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const deviceIdHash = hashTossDeviceId(parsed.data.deviceId);
    const service = createServiceRoleClient();
    const { error } = await service
      .from('toss_device_connections')
      .upsert(
        {
          user_id: user.id,
          device_id_hash: deviceIdHash,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id_hash' },
      );

    if (error) {
      return apiErrorResponse('INTERNAL_ERROR', error.message, 500);
    }

    return NextResponse.json({ ok: true, registered: true });
  } catch (err) {
    console.error('[POST /api/toss/device]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
