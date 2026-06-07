import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { LoginClient } from './login-client';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = normalizeNext(readParam(params.next));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect(next);

  return <LoginClient next={next} />;
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';

  const nextUrl = new URL(value, 'http://twoday.local');
  if (
    nextUrl.pathname === '/login' ||
    nextUrl.pathname === '/signup' ||
    nextUrl.pathname === '/start'
  ) {
    return '/';
  }

  return `${nextUrl.pathname}${nextUrl.search}`;
}
