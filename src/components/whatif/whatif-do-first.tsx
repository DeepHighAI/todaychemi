'use client';

import { useTranslations } from 'next-intl';

interface WhatifDoFirstProps {
  items: readonly string[];
}

export function WhatifDoFirst({ items }: WhatifDoFirstProps) {
  const t = useTranslations('whatif.result');
  return (
    <div data-testid="whatif-do-first" className="rounded-2xl bg-primary/10 p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('section.do_first')}</p>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="text-sm font-bold text-primary">{i + 1}</span>
            <span className="text-sm text-foreground">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
