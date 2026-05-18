'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function TodayAppBar() {
  const t = useTranslations('home');
  return (
    <div className="sticky top-0 z-40 bg-surface-1 flex items-center justify-between px-4 h-14">
      <h1 className="font-h3 text-foreground">{t('greeting')}</h1>
      <Link href="/relations/new" className="text-primary font-semibold text-sm">
        {t('add_relation')}
      </Link>
    </div>
  );
}
