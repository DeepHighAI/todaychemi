'use client';

import Link from 'next/link';
import { UsersRound } from 'lucide-react';

import { AvoidActionCards } from '@/components/today/avoid-action-cards';
import { DateLine } from '@/components/today/date-line';
import { buttonVariants } from '@/components/ui/button';
import type { GuestTodaySnapshot } from '@/lib/guest/session';
import { convertHanja } from '@/lib/glossary/post-process';
import { scoreToTemperature } from '@/lib/scoring/temperature';
import { todayKST } from '@/lib/today/kst-date';
import { cn } from '@/lib/utils';

function formatKstDate(iso: string): string {
  return iso.replaceAll('-', '.');
}

export function GuestTodayMeView({ snapshot }: { snapshot: GuestTodaySnapshot }) {
  const score = snapshot.card.today_compat_score ?? null;
  const temperature = typeof score === 'number' ? scoreToTemperature(score).toFixed(1) : null;

  return (
    <main className="min-h-screen space-y-4 bg-background pb-28 pt-5">
      <header className="px-4">
        <p className="font-eyebrow text-primary">오늘 나의 흐름</p>
        <h1 className="mt-1 text-2xl font-black text-foreground">
          {snapshot.onboarding.nickname}님의 오늘을 먼저 볼게요.
        </h1>
      </header>

      <DateLine date={formatKstDate(todayKST())} dayPillar={snapshot.chart.day_pillar} />

      <section className="mx-4 space-y-3 rounded-[var(--r-xl)] bg-liquid-hero p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/80">
          오늘 나의 흐름
        </p>
        {temperature ? (
          <p className="font-display mt-1 text-[56px] font-black leading-none tabular-nums">
            {temperature}
            <span className="ml-1 align-baseline text-[18px] font-bold text-white/85">°C</span>
          </p>
        ) : (
          <p className="mt-1 text-3xl font-black leading-tight">
            {convertHanja(snapshot.card.headline)}
          </p>
        )}
        <p className="text-sm leading-[1.55] text-white/88">
          {convertHanja(snapshot.card.headline_reason)}
        </p>
      </section>

      <AvoidActionCards card={snapshot.card} />

      <section className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-[var(--r-lg)] border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <Link
          href="/signup?intent=guest"
          className={cn(buttonVariants({ variant: 'default' }), 'h-12 w-full gap-2 rounded-[var(--r-pill)] font-bold')}
        >
          <UsersRound size={18} />
          친구와의 오늘 우리는 보기
        </Link>
      </section>
    </main>
  );
}
