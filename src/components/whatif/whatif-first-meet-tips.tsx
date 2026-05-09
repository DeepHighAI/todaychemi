'use client';

import { useTranslations } from 'next-intl';

interface WhatifFirstMeetTipsProps {
  tips: readonly string[];
}

export function WhatifFirstMeetTips({ tips }: WhatifFirstMeetTipsProps) {
  const t = useTranslations('whatif.result');
  return (
    <div data-testid="whatif-first-meet-tips" className="rounded-2xl bg-primary/10 p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('section.first_meet_tips')}</p>
      <ol className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="text-sm font-bold text-primary">{i + 1}</span>
            <span className="text-sm text-foreground">{tip}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
