import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { SignupClient } from './signup-client';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;
  const isGuestIntent = readParam(params.intent) === 'guest';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect(isGuestIntent ? '/guest/complete' : '/');

  return <SignupClient isGuestIntent={isGuestIntent} />;
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
