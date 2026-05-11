'use client';

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';

interface HapcardBodyProps {
  mainText: string;
}

export function HapcardBody({ mainText }: HapcardBodyProps) {
  const t = useTranslations('hapcard');
  // LLM 출력에 한자가 포함될 경우를 대비한 UI 레이어 안전망
  const safeText = convertHanja(mainText);
  return (
    <div data-testid="hapcard-body" className="rounded-2xl bg-card p-6 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {t('body.eyebrow')}
      </p>
      <p className="text-base font-semibold text-foreground text-balance whitespace-pre-line">
        {safeText}
      </p>
    </div>
  );
}
