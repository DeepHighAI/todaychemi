'use client';

import { useTranslations } from 'next-intl';

// Phase 5 placeholder — TabBar /me 링크 404 방지용. 후속 PR에서 본명식 화면 조립
export default function MePage() {
  const t = useTranslations('me');
  return (
    <div className="px-4 py-12">
      <h1 className="text-xl font-semibold text-foreground">{t('placeholder')}</h1>
    </div>
  );
}
