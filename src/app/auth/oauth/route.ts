import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import type { LegalConsentProvider } from '@/lib/legal/consent';
import { getSupabasePublicConfig } from '@/lib/supabase/env';

const AUTH_CALLBACK_FAILED = '/login?error=auth_callback_failed';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { origin, searchParams } = requestUrl;
  const provider = parseProvider(searchParams.get('provider'));

  if (!provider) {
    return NextResponse.redirect(`${origin}${AUTH_CALLBACK_FAILED}`);
  }

  const callbackUrl = new URL('/auth/callback', origin);
  callbackUrl.searchParams.set('provider', provider);

  const next = sanitizeNextPath(searchParams.get('next'));
  if (next) {
    callbackUrl.searchParams.set('next', next);
  }

  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}${AUTH_CALLBACK_FAILED}`);
  }

  return NextResponse.redirect(data.url);
}

function parseProvider(value: string | null): LegalConsentProvider | null {
  return value === 'google' || value === 'kakao' ? value : null;
}

function sanitizeNextPath(next: string | null): string | null {
  if (!next) return null;
  return next.startsWith('/') && !next.startsWith('//') ? next : null;
}
