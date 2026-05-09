'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

// UIDesign screens-relation.jsx::ScreenHome "인연 등록 입구" card brand 행
export function QuickAddRelation() {
  const t = useTranslations('home');
  return (
    <div className="px-4">
      <Link
        href="/relations/new"
        className="block rounded-[var(--r-md)] bg-[var(--p-95)] p-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--p-40)] text-white text-2xl font-light">
            ＋
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-[var(--p-10)]">{t('add_relation')}</div>
            <div className="text-xs text-[var(--p-30)] mt-0.5">{t('add_relation_sub')}</div>
          </div>
          <span className="text-[var(--p-30)] text-lg">›</span>
        </div>
      </Link>
    </div>
  );
}
