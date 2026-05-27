'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { LoadingState } from '@/components/feedback/LoadingState';
import { buttonVariants } from '@/components/ui/button';
import { clearGuestFlow, loadGuestOnboarding } from '@/lib/guest/session';
import { cn } from '@/lib/utils';

export default function GuestCompletePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function migrate() {
      const onboarding = loadGuestOnboarding();
      if (!onboarding) {
        router.replace('/start');
        return;
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(onboarding),
      });

      if (cancelled) return;

      if (res.ok || res.status === 409) {
        clearGuestFlow();
        router.replace('/relations/new');
        return;
      }

      if (res.status === 401) {
        router.replace('/login?next=/guest/complete');
        return;
      }

      if (res.status === 403) {
        clearGuestFlow();
        router.replace('/start');
        return;
      }

      setError('계정으로 이어받지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    void migrate().catch(() => {
      if (!cancelled) setError('계정으로 이어받지 못했어요. 잠시 후 다시 시도해주세요.');
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 rounded-[var(--r-lg)] bg-card p-5 text-center">
        {!error ? (
          <>
            <LoadingState />
            <p className="text-sm text-muted-foreground">방금 본 내 사주를 계정에 연결하고 있어요.</p>
          </>
        ) : (
          <>
            <p className="font-h3 text-foreground">이어받기 실패</p>
            <p className="font-sub text-muted-foreground">{error}</p>
            <Link href="/start" className={cn(buttonVariants({ variant: 'default' }), 'h-11 w-full')}>
              처음부터 다시 시작
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
