'use client';

import Link from 'next/link';
import { Plus, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

// UIDesign screens-relation.jsx::ScreenHome "인연 등록 입구" card brand 행
export function QuickAddRelation() {
  const t = useTranslations('home');
  return (
    <div className="px-4">
      <Link
        href="/relations/new"
        className="block rounded-[var(--r-lg)] bg-[var(--p-95)] p-4 ring-1 ring-[var(--p-90)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--p-40)] text-white">
            <Plus className="size-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-[var(--p-10)]">{t('add_relation')}</div>
            <div className="text-xs text-[var(--p-30)] mt-0.5">{t('add_relation_sub')}</div>
          </div>
          <ChevronRight className="size-5 text-[var(--p-30)]" aria-hidden="true" />
        </div>
      </Link>
    </div>
  );
}
