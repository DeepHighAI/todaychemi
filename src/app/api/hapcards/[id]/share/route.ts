import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { buildPublicShareUrls, buildSharePayload } from '@/lib/share/build-share-payload';
import { ShareChannelSchema, ShareRangeSchema } from '@/lib/share/schema';
import { generateShareToken, hashShareToken } from '@/lib/share/token';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const SHARE_TTL_DAYS = 30;
const OHAENG_ZERO_COUNTS: Record<string, number> = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };

const ShareCreateRequestSchema = z
  .object({
    range: ShareRangeSchema,
    channel: ShareChannelSchema,
  })
  .strict();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiErrorResponse('INVALID_BODY', 'invalid hapcard id', 400);
    }

    const body = ShareCreateRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return apiErrorResponse('INVALID_BODY', 'invalid share request', 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const { data: hapcardRow, error: hapcardError } = await supabase
      .from('hapcards')
      .select('hapcard_id,user_id,relation_id,mode,compat_score')
      .eq('hapcard_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (hapcardError) {
      return apiErrorResponse('INTERNAL_ERROR', hapcardError.message, 500);
    }
    if (!hapcardRow) {
      return apiErrorResponse('HAPCARD_NOT_FOUND', '', 404);
    }

    const hapcard = hapcardRow as {
      hapcard_id: string;
      user_id: string;
      relation_id: string;
      mode: string;
      compat_score: number;
    };

    const { data: relationRow, error: relationError } = await supabase
      .from('relations')
      .select('nickname,gender')
      .eq('relation_id', hapcard.relation_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (relationError) {
      return apiErrorResponse('INTERNAL_ERROR', relationError.message, 500);
    }
    if (!relationRow) {
      return apiErrorResponse('HAPCARD_NOT_FOUND', '', 404);
    }

    const relation = relationRow as { nickname?: string | null; gender?: string | null };
    const ohaengCounts = await loadRelationOhaengCounts(supabase, hapcard.relation_id);
    const token = generateShareToken();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const urls = buildPublicShareUrls(origin, token);
    const payload = buildSharePayload({
      hapcard_id: hapcard.hapcard_id,
      mode: hapcard.mode,
      nickname: relation.nickname ?? '인연',
      score: hapcard.compat_score,
      gender_normalized: relation.gender === 'M' ? 'M' : 'F',
      ohaeng_counts: ohaengCounts,
      origin,
      range: body.data.range,
      public_url: urls.url,
      og_image_url: urls.og_image_url,
    });
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 86_400_000).toISOString();
    const service = createServiceRoleClient();

    const { data: shareRow, error: shareError } = await service
      .from('hapcard_shares')
      .insert({
        user_id: user.id,
        hapcard_id: hapcard.hapcard_id,
        relation_id: hapcard.relation_id,
        token_hash: hashShareToken(token),
        range: body.data.range,
        channel: body.data.channel,
        title: payload.title,
        message_text: payload.text,
        expires_at: expiresAt,
      })
      .select('share_id,expires_at')
      .single();

    if (shareError || !shareRow) {
      return apiErrorResponse('INTERNAL_ERROR', shareError?.message ?? '', 500);
    }

    return NextResponse.json({
      ok: true,
      share_id: (shareRow as { share_id: string }).share_id,
      url: payload.url,
      og_image_url: urls.og_image_url,
      title: payload.title,
      text: payload.text,
      expires_at: (shareRow as { expires_at: string }).expires_at,
    });
  } catch (err) {
    console.error('[/api/hapcards/[id]/share]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

async function loadRelationOhaengCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  relationId: string,
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('relation_charts')
    .select('chart_core')
    .eq('relation_id', relationId)
    .maybeSingle();

  const chart = data as { chart_core?: { five_elements_counts?: Record<string, number> } } | null;
  return chart?.chart_core?.five_elements_counts ?? OHAENG_ZERO_COUNTS;
}
