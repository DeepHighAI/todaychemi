'use client';

import { Pencil, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  onClick: () => void;
}

export function MeEditRow({ onClick }: Props) {
  const t = useTranslations('me');
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left rounded-[var(--r-md)] bg-[var(--surface-1)] p-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface-2)]">
          <Pencil className="size-5 text-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-foreground">{t('editRow.title')}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{t('editRow.sub')}</div>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
    </button>
  );
}
