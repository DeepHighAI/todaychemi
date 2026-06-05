'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { LegalConsentBlock } from '@/components/legal/legal-consent-block';
import { Button } from '@/components/ui/button';
import { signUpWithEmail } from '@/lib/auth/email';
import { signInWithGoogle } from '@/lib/auth/google';
import { signInWithKakao } from '@/lib/auth/kakao';
import { loadGuestOnboarding } from '@/lib/guest/session';
import { validatePassword } from '@/lib/auth/password-policy';
import {
  EMPTY_LEGAL_CONSENT,
  isLegalConsentComplete,
  type LegalConsentState,
} from '@/lib/legal/consent';

export default function SignupPage() {
  const t = useTranslations('auth.signup');
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGuestIntent = searchParams.get('intent') === 'guest';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legalConsent, setLegalConsent] = useState<LegalConsentState>(EMPTY_LEGAL_CONSENT);
  const [loading, setLoading] = useState(false);
  const legalComplete = isGuestIntent || isLegalConsentComplete(legalConsent);

  useEffect(() => {
    if (isGuestIntent && !loadGuestOnboarding()) {
      router.replace('/start');
    }
  }, [isGuestIntent, router]);

  async function handleGoogle() {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle(legalConsent, {
        next: '/guest/complete',
        reuseExistingConsent: isGuestIntent,
      });
    } catch {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  }

  async function handleKakao() {
    try {
      setLoading(true);
      setError(null);
      await signInWithKakao(legalConsent, {
        next: '/guest/complete',
        reuseExistingConsent: isGuestIntent,
      });
    } catch {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    if (!email.trim()) {
      setEmailError(t('errorEmailRequired'));
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      setPasswordError(
        validation.code === 'tooShort' ? t('errorPasswordTooShort') : t('errorPasswordWeak'),
      );
      return;
    }

    try {
      setLoading(true);
      await signUpWithEmail(email, password, legalConsent, {
        reuseExistingConsent: isGuestIntent,
      });
      router.push(isGuestIntent ? '/guest/complete' : '/onboarding');
    } catch (err: unknown) {
      setLoading(false);
      const status = (err as { status?: number }).status;
      if (status === 422) setError(t('errorEmailTaken'));
      else if (status === 429) setError(t('errorRateLimited'));
      else setError(t('errorGeneric'));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-[var(--r-xl)] bg-card p-8 shadow">

        <h1 className="mb-6 text-center text-xl font-semibold text-foreground">{t('title')}</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
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
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
            {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
          </div>

          {isGuestIntent ? (
            <p className="rounded-[var(--r-md)] bg-[var(--surface-1)] p-3 text-xs text-muted-foreground">
              게스트 체험에서 필수 동의를 완료했어요. 가입 후 방금 본 내 사주를 이어받습니다.
            </p>
          ) : (
            <LegalConsentBlock
              value={legalConsent}
              onChange={setLegalConsent}
              disabled={loading}
              title={t('legalTitle')}
            />
          )}

          <Button
            type="submit"
            disabled={loading || !legalComplete}
            variant="default"
            className="h-11 w-full"
          >
            {loading ? t('loading') : t('submitButton')}
          </Button>
        </form>

        {isGuestIntent && (
          <>
            <div className="relative my-4 flex items-center">
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
              {loading ? t('loading') : 'Google로 시작하기'}
            </Button>

            <Button
              type="button"
              onClick={handleKakao}
              disabled={loading}
              variant="outline"
              className="mt-2 h-11 w-full border-[var(--kakao-yellow)] bg-[var(--kakao-yellow)] text-white hover:bg-[var(--kakao-yellow-hover)] hover:text-white disabled:text-white"
            >
              {loading ? t('loading') : '카카오로 시작하기'}
            </Button>
          </>
        )}

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        <div className="mt-4 flex justify-center text-xs text-muted-foreground">
          <Link
            href={isGuestIntent ? '/login?next=/guest/complete' : '/login'}
            className="inline-flex min-h-[44px] items-center px-4 underline"
          >
            {t('loginLink')}
          </Link>
        </div>
      </div>
    </main>
  );
}
