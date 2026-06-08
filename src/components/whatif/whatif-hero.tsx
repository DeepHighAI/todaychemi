'use client';

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';
import { AiDisclosureBadge } from '@/components/ai-disclosure/ai-disclosure-badge';
import type { DiagnosticType } from '@/types/diagnostic';

interface WhatifHeroProps {
  type: DiagnosticType;
  body: string;
}

export function WhatifHero({ type, body }: WhatifHeroProps) {
  const t = useTranslations('whatif.card');
  return (
    <div data-testid="whatif-hero" className="rounded-2xl bg-card p-6 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t(`${type}.title`)}
        </p>
        <AiDisclosureBadge tone="light" />
      </div>
      <p className="text-base text-foreground whitespace-pre-line">{convertHanja(body)}</p>
    </div>
  );
}
