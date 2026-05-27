'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { LoadingState } from '@/components/feedback/LoadingState';
import { GuestTodayMeView } from '@/components/today/guest-today-me-view';
import { loadGuestToday, type GuestTodaySnapshot } from '@/lib/guest/session';

export default function GuestTodayMePage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<GuestTodaySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loaded = loadGuestToday();
    if (!loaded) {
      router.replace('/start');
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) setSnapshot(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <LoadingState />
      </main>
    );
  }

  return <GuestTodayMeView snapshot={snapshot} />;
}
