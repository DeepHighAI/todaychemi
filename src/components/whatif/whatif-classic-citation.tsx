'use client';

import { useTranslations } from 'next-intl';
import type { ClassicCitation } from '@/types/diagnostic';

interface WhatifClassicCitationProps {
  citations?: ClassicCitation[];
}

export function WhatifClassicCitation({ citations }: WhatifClassicCitationProps) {
  const t = useTranslations('whatif.result');
  if (!citations || citations.length === 0) return null;
  return (
    <div data-testid="whatif-classic-citation" className="rounded-2xl bg-card p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('section.classic_citation')}</p>
      <ul className="space-y-4">
        {citations.map((c, i) => (
          <li key={i} className="border border-border rounded-xl p-3 space-y-1">
            <p className="text-xs font-medium text-primary">{c.source_title}</p>
            <p className="text-xs text-muted-foreground">{c.source_chapter}</p>
            <p className="text-sm text-foreground italic">{c.original_text}</p>
            <p className="text-xs text-muted-foreground">{c.modern_translation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
