'use client';

import { useTranslations } from 'next-intl';

export function HapcardShare() {
  const t = useTranslations('hapcard');
  return (
    <div data-testid="hapcard-share" className="px-4 pb-8 flex justify-center">
      <button
        type="button"
        onClick={() => {}}
        className="rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold"
      >
        공유합카드 만들기
      </button>
    </div>
  );
}
