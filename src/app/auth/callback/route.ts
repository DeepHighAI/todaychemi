import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import {
  claimLegalConsentFromCookie,
  clearLegalConsentCookie,
} from '@/lib/legal/server-consent';
import type { LegalConsentProvider } from '@/lib/legal/consent';
import { hasPublicUserProfile } from '@/lib/auth/user-profile';
import { getSupabasePublicConfig } from '@/lib/supabase/env';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const provider = parseProvider(searchParams.get('provider'));
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const user = data?.user;
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const serviceClient = createServiceRoleClient();

  try {
    const hasProfile = await hasPublicUserProfile(serviceClient, user.id);
    if (hasProfile) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    const legalConsent = await claimLegalConsentFromCookie({
      serviceClient,
      cookieStore,
      userId: user.id,
    });
    if (legalConsent) {
      clearLegalConsentCookie(cookieStore);
      return NextResponse.redirect(`${origin}${next}`);
    }
  } catch {
    return NextResponse.redirect(`${origin}/login?error=legal_consent_failed`);
  }

  if (!provider) {
    return NextResponse.redirect(`${origin}/login?error=legal_consent_failed`);
  }

  const socialConsentUrl = new URL('/auth/social-consent', origin);
  socialConsentUrl.searchParams.set('provider', provider);
  socialConsentUrl.searchParams.set('next', next === '/' ? '/onboarding' : next);
  return NextResponse.redirect(socialConsentUrl);
}

function parseProvider(value: string | null): LegalConsentProvider | null {
  return value === 'google' || value === 'kakao' ? value : null;
}
