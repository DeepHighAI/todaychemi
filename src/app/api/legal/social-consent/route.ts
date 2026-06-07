import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasPublicUserProfile } from '@/lib/auth/user-profile';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { LEGAL_CONSENT_PROVIDERS } from '@/lib/legal/consent';
import { createClaimedLegalConsentRecord } from '@/lib/legal/server-consent';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const SocialConsentRequestSchema = z
  .object({
    terms: z.literal(true),
    privacy: z.literal(true),
    age: z.literal(true),
    provider: z.enum(LEGAL_CONSENT_PROVIDERS),
  })
  .strict();

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return apiErrorResponse('INVALID_ORIGIN', '', 403);
    }

    const parsed = SocialConsentRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiErrorResponse('INVALID_BODY', 'legal consent required', 400);
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const serviceClient = createServiceRoleClient();
    const hasProfile = await hasPublicUserProfile(serviceClient, user.id);
    if (!hasProfile) {
      await createClaimedLegalConsentRecord({
        serviceClient,
        flow: 'oauth',
        provider: parsed.data.provider,
        userId: user.id,
      });
    }

    return NextResponse.json({ ok: true, already_onboarded: hasProfile });
  } catch (err) {
    console.error('[/api/legal/social-consent]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const allowed = new Set([new URL(request.url).origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  }

  return allowed.has(origin);
}
