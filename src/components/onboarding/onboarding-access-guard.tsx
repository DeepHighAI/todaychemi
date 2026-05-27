'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { hasGuestLegalConsentReady } from '@/lib/guest/session';
import { LoadingState } from '@/components/feedback/LoadingState';

export function OnboardingAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (hasGuestLegalConsentReady()) {
      queueMicrotask(() => {
        if (!cancelled) setAllowed(true);
      });
      return () => {
        cancelled = true;
      };
    }

    void fetch('/api/me')
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.replace('/start');
          return;
        }
        setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) router.replace('/start');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!allowed) {
    return (
      <div className="px-4">
        <LoadingState />
      </div>
    );
  }

  return <>{children}</>;
}
