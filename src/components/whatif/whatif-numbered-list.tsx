'use client';

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';

interface WhatifNumberedListProps {
  testid: string;
  titleKey: string;
  items: readonly string[];
}

export function WhatifNumberedList({ testid, titleKey, items }: WhatifNumberedListProps) {
  const t = useTranslations('whatif.result');
  return (
    <div data-testid={testid} className="rounded-2xl bg-primary/10 p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t(titleKey)}</p>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="text-sm font-bold text-primary">{i + 1}</span>
            <span className="text-sm text-foreground">{convertHanja(item)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
