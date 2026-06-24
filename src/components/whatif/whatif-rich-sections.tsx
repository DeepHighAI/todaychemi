'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { convertHanja } from '@/lib/glossary/post-process';
import type {
  WhatifSajuBasis,
  WhatifSituationReading,
  WhatifTodayContext,
} from '@/types/diagnostic';

function Card({ testid, title, children }: { testid: string; title: string; children: ReactNode }) {
  return (
    <section data-testid={testid} className="rounded-2xl bg-card p-5 space-y-3">
      <p className="text-sm font-bold text-foreground">{title}</p>
      {children}
    </section>
  );
}

function ChipList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {convertHanja(item)}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="text-sm leading-6 text-foreground">
          {convertHanja(item)}
        </li>
      ))}
    </ul>
  );
}

export function WhatifTodayContextCard({
  context,
  targetDate,
}: {
  context?: WhatifTodayContext;
  targetDate: string;
}) {
  const t = useTranslations('whatif.result.section');
  if (!context) return null;
  return (
    <Card testid="whatif-today-context" title={t('today_context')}>
      <div className="space-y-2">
        <p className="text-base font-extrabold text-foreground">{convertHanja(context.title)}</p>
        <p className="text-xs font-semibold text-muted-foreground">{targetDate.replaceAll('-', '.')}</p>
        <p className="text-sm leading-6 text-foreground/90">{convertHanja(context.summary)}</p>
        <p className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold leading-5 text-muted-foreground">
          {convertHanja(context.day_signal)}
        </p>
      </div>
    </Card>
  );
}

export function WhatifSajuBasisCard({ basis }: { basis?: WhatifSajuBasis }) {
  const t = useTranslations('whatif.result.section');
  if (!basis) return null;
  return (
    <Card testid="whatif-saju-basis" title={t('saju_basis')}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-muted p-3">
            <p className="font-semibold text-muted-foreground">{t('day_master')}</p>
            <p className="mt-1 font-bold text-foreground">{convertHanja(basis.day_master)}</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="font-semibold text-muted-foreground">{t('sinkang')}</p>
            <p className="mt-1 font-bold text-foreground">{basis.sinkang ?? t('unknown')}</p>
          </div>
        </div>
        <ChipList items={[...basis.dominant_sipsin, ...basis.missing_sipsin, ...basis.yongsin_candidates]} />
        <BulletList items={basis.notes} />
      </div>
    </Card>
  );
}

export function WhatifSituationReadingCard({ reading }: { reading?: WhatifSituationReading }) {
  const t = useTranslations('whatif.result.section');
  if (!reading) return null;
  return (
    <Card testid="whatif-situation-reading" title={t('situation_reading')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-primary/10 p-3">
          <p className="mb-2 text-xs font-bold text-primary">{t('strength')}</p>
          <BulletList items={reading.strength} />
        </div>
        <div className="rounded-xl bg-amber-500/10 p-3">
          <p className="mb-2 text-xs font-bold text-amber-700">{t('caution')}</p>
          <BulletList items={reading.caution} />
        </div>
      </div>
    </Card>
  );
}

export function WhatifAvoidTodayCard({ items }: { items?: readonly string[] }) {
  const t = useTranslations('whatif.result.section');
  if (!items || items.length === 0) return null;
  return (
    <Card testid="whatif-avoid-today" title={t('avoid_today')}>
      <BulletList items={items} />
    </Card>
  );
}
