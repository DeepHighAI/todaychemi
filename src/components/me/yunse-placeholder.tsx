'use client';

import { useTranslations } from 'next-intl';

export function YunsePlaceholder() {
  const t = useTranslations('me.section.yunse');
  return (
    <div data-testid="yunse-placeholder" className="rounded-2xl border border-border bg-card p-4 space-y-1">
      <p className="text-sm font-semibold text-foreground">{t('title')}</p>
      <p className="text-xs text-muted-foreground">{t('body')}</p>
    </div>
  );
}
