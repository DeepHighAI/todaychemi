import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import {
  LEGAL_CONSENT_FLOWS,
  LEGAL_CONSENT_PROVIDERS,
} from '@/lib/legal/consent';
import {
  LEGAL_GUEST_CONSENT_TTL_SECONDS,
  createLegalConsentRecord,
  createSignedGuestLegalConsentToken,
  setLegalConsentCookie,
} from '@/lib/legal/server-consent';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const LegalConsentRequestSchema = z
  .object({
    terms: z.literal(true),
    privacy: z.literal(true),
    age: z.literal(true),
    flow: z.enum(LEGAL_CONSENT_FLOWS),
    provider: z.enum(LEGAL_CONSENT_PROVIDERS).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.flow === 'oauth' && !value.provider) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['provider'], message: 'provider required' });
    }
    if (value.flow === 'email' && value.provider) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['provider'], message: 'provider not allowed' });
    }
    if (value.flow === 'guest' && value.provider) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['provider'], message: 'provider not allowed' });
    }
  });

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return apiErrorResponse('INVALID_ORIGIN', '', 403);
    }

    const parsed = LegalConsentRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiErrorResponse('INVALID_BODY', 'legal consent required', 400);
    }

    const ttlSeconds =
      parsed.data.flow === 'guest' ? LEGAL_GUEST_CONSENT_TTL_SECONDS : undefined;
    const { token, expiresAt } = await createConsentToken({
      flow: parsed.data.flow,
      provider: parsed.data.provider ?? null,
      ttlSeconds,
    });

    const cookieStore = await cookies();
    setLegalConsentCookie(cookieStore, token, ttlSeconds);

    return NextResponse.json({ ok: true, expires_at: expiresAt });
  } catch (err) {
    console.error('[/api/legal/consent]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

async function createConsentToken({
  flow,
  provider,
  ttlSeconds,
}: {
  flow: (typeof LEGAL_CONSENT_FLOWS)[number];
  provider: (typeof LEGAL_CONSENT_PROVIDERS)[number] | null;
  ttlSeconds?: number;
}) {
  try {
    const service = createServiceRoleClient();
    return await createLegalConsentRecord({
      serviceClient: service,
      flow,
      provider,
      ttlSeconds,
    });
  } catch (err) {
    if (flow === 'guest' && process.env.NODE_ENV !== 'production') {
      console.warn('[/api/legal/consent] using signed guest consent fallback', {
        error: sanitizeErrorForLog(err),
      });
      return createSignedGuestLegalConsentToken({ ttlSeconds });
    }
    throw err;
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
