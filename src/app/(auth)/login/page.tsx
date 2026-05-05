'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/auth/google';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow">
        <h1 className="mb-6 text-center text-xl font-semibold text-foreground">{t('title')}</h1>
        <Button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          variant="default"
          className="h-11 w-full"
        >
          {loading ? t('loading') : t('googleButton')}
        </Button>
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
