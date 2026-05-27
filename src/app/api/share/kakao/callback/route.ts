import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const KakaoCallbackSchema = z.object({
  share_id: z.string().uuid(),
});

export async function GET(request: Request) {
  return handleKakaoCallback(request, 'GET');
}

export async function POST(request: Request) {
  return handleKakaoCallback(request, 'POST');
}

async function handleKakaoCallback(request: Request, method: 'GET' | 'POST') {
  try {
    const adminKey = process.env.KAKAO_ADMIN_KEY;
    if (!adminKey) {
      return apiErrorResponse('KAKAO_ADMIN_KEY_MISSING', '', 500);
    }

    const authorization = request.headers.get('authorization') ?? '';
    if (authorization !== `KakaoAK ${adminKey}`) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const resourceId = request.headers.get('x-kakao-resource-id');
    if (!resourceId) {
      return apiErrorResponse('INVALID_BODY', 'missing Kakao resource id', 400);
    }

    const payload = await readKakaoPayload(request, method);
    const parsed = KakaoCallbackSchema.safeParse(payload);
    if (!parsed.success) {
      return apiErrorResponse('INVALID_BODY', 'missing share_id', 400);
    }

    const service = createServiceRoleClient();
    const { data: reward, error } = await service.rpc('award_hapcard_share_reward', {
      p_share_id: parsed.data.share_id,
      p_channel: 'kakao',
      p_webhook_resource_id: resourceId,
    });

    if (error) {
      return apiErrorResponse('INTERNAL_ERROR', error.message, 500);
    }

    if (isRewardReason(reward, 'SHARE_NOT_FOUND')) {
      return apiErrorResponse('SHARE_NOT_FOUND', '', 404);
    }

    return NextResponse.json({ ok: true, reward });
  } catch (err) {
    console.error('[/api/share/kakao/callback]', err);
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

async function readKakaoPayload(request: Request, method: 'GET' | 'POST') {
  if (method === 'GET') {
    return Object.fromEntries(new URL(request.url).searchParams.entries());
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return request.json().catch(() => ({}));
  }

  const text = await request.text().catch(() => '');
  return Object.fromEntries(new URLSearchParams(text).entries());
}

function isRewardReason(reward: unknown, reason: string): boolean {
  return Boolean(
    reward &&
      typeof reward === 'object' &&
      'reason' in reward &&
      (reward as { reason?: unknown }).reason === reason,
  );
}
