'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/auth/google';
import { signInWithKakao } from '@/lib/auth/kakao';
import { signInWithEmail } from '@/lib/auth/email';
import { cn } from '@/lib/utils';
import { EMPTY_LEGAL_CONSENT } from '@/lib/legal/consent';

interface LoginClientProps {
  next: string;
}

export function LoginClient({ next }: LoginClientProps) {
  const t = useTranslations('auth.login');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle(EMPTY_LEGAL_CONSENT, { next, deferLegalConsent: true });
    } catch {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  }

  async function handleKakao() {
    try {
      setLoading(true);
      setError(null);
      await signInWithKakao(EMPTY_LEGAL_CONSENT, { next, deferLegalConsent: true });
    } catch {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailError(null);

    if (!email.trim()) {
      setEmailError(t('errorEmailRequired'));
      return;
    }

    try {
      setLoading(true);
      await signInWithEmail(email, password);
      router.push(next);
    } catch {
      setError(t('errorInvalidCredentials'));
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-[var(--r-xl)] bg-card p-8 shadow">

        <h1 className="mb-6 text-center text-xl font-semibold text-foreground">{t('title')}</h1>

        <form onSubmit={handleEmailSubmit} className="mb-4 flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              {t('emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full rounded-[var(--r-sm)] border border-border bg-[var(--surface-1)] px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              autoComplete="email"
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              {t('passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-[var(--r-sm)] border border-border bg-[var(--surface-1)] px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" disabled={loading} variant="default" className="h-11 w-full">
            {t('submitButton')}
          </Button>
        </form>

        <div className="relative mb-4 flex items-center">
          <div className="flex-1 border-t border-border" />
          <span className="px-3 text-xs text-muted-foreground">또는</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <Button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          variant="outline"
          className="h-11 w-full"
        >
          {loading ? t('loading') : t('googleButton')}
        </Button>

        <Button
          type="button"
          onClick={handleKakao}
          disabled={loading}
          variant="outline"
          className="mt-2 h-11 w-full border-[var(--kakao-yellow)] bg-[var(--kakao-yellow)] text-white hover:bg-[var(--kakao-yellow-hover)] hover:text-white disabled:text-white"
        >
          {loading ? t('loading') : t('kakaoButton')}
        </Button>

        <Link
          href="/guest/start"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'mt-2 h-11 w-full text-muted-foreground',
          )}
        >
          {t('browseButton')}
        </Link>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        <div className="mt-4 flex justify-center text-xs text-muted-foreground">
          <Link href="/signup" className="inline-flex min-h-[44px] items-center px-4 underline">
            {t('signupLink')}
          </Link>
        </div>
      </div>
    </main>
  );
}
