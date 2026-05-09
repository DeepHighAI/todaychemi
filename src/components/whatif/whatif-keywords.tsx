'use client';

import { useTranslations } from 'next-intl';

interface WhatifKeywordsProps {
  keywords: readonly string[];
}

export function WhatifKeywords({ keywords }: WhatifKeywordsProps) {
  const t = useTranslations('whatif.result');
  return (
    <div data-testid="whatif-keywords" className="rounded-2xl bg-card p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('section.keywords')}</p>
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-primary/10 text-primary"
          >
            {keyword}
          </span>
        ))}
      </div>
    </div>
  );
}
