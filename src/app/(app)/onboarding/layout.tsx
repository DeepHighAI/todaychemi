'use client';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { OnboardingAccessGuard } from '@/components/onboarding/onboarding-access-guard';

const STEPS = ['/onboarding/dob', '/onboarding/time', '/onboarding/cal-gender', '/onboarding/review'];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const stepIndex = STEPS.findIndex((s) => pathname.startsWith(s));
  const current = stepIndex >= 0 ? stepIndex + 1 : 1;
  const total = 4;

  return (
    <main className="bg-background min-h-screen pb-32">
      <header className="px-4 pt-3 pb-4 space-y-3">
        <button onClick={() => router.back()} aria-label="back"
          className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-foreground active:opacity-60">
          <ChevronLeft size={22} />
        </button>
        <div className="h-1 bg-surface-2 rounded-full">
          <div className="h-full bg-[var(--p-40)] rounded-full transition-[width] duration-300"
            style={{ width: `${(current / total) * 100}%` }} />
        </div>
        <p className="font-eyebrow text-primary">{current} / {total}</p>
      </header>
      <OnboardingAccessGuard>{children}</OnboardingAccessGuard>
    </main>
  );
}
