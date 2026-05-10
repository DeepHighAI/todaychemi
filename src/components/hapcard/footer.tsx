'use client';

import { useTranslations } from 'next-intl';

export function HapcardFooter() {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-footer" className="px-4 py-6 text-center">
      <p className="text-xs text-muted-foreground">{t('footer.disclaimer')}</p>
    </div>
  );
}
