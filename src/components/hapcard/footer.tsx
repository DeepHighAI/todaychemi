'use client';

import { useTranslations } from 'next-intl';

export function HapcardFooter() {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-footer" className="px-4 py-6 space-y-2 text-center">
      <p className="text-xs text-muted-foreground">{t('footer.disclaimer')}</p>
      <p className="text-xs text-muted-foreground/70">{t('footer.replayHint')}</p>
    </div>
  );
}
