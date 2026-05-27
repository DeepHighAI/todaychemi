import { redirect } from 'next/navigation';

import type { LegalConsentProvider } from '@/lib/legal/consent';
import { createClient } from '@/lib/supabase/server';

import { SocialConsentClient } from './social-consent-client';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SocialConsentPage({ searchParams }: Props) {
  const params = await searchParams;
  const provider = parseProvider(readParam(params.provider));
  if (!provider) redirect('/login?error=auth_callback_failed');

  const next = sanitizeNext(readParam(params.next)) ?? '/onboarding';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return <SocialConsentClient provider={provider} next={next} />;
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseProvider(value: string | null): LegalConsentProvider | null {
  return value === 'google' || value === 'kakao' ? value : null;
}

function sanitizeNext(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}
