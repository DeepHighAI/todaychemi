'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { signUpWithEmail } from '@/lib/auth/email';
import { validatePassword } from '@/lib/auth/password-policy';

export default function SignupPage() {
  const t = useTranslations('auth.signup');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      await signUpWithEmail(email, password);
      router.push('/onboarding');
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
      <div className="w-full max-w-sm bg-card p-8 shadow" style={{borderRadius:'var(--r-xl)'}}>

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
              className="w-full border border-border bg-[var(--surface-1)] px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" style={{borderRadius:'var(--r-sm)'}}
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
              className="w-full border border-border bg-[var(--surface-1)] px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" style={{borderRadius:'var(--r-sm)'}}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
            {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
          </div>

          <Button type="submit" disabled={loading} variant="default" className="h-11 w-full">
            {loading ? t('loading') : t('submitButton')}
          </Button>
        </form>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline">
            {t('loginLink')}
          </Link>
        </p>
      </div>
    </main>
  );
}
