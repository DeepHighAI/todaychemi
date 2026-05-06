'use client';

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function QuickAddRelation() {
  const t = useTranslations('home');
  return (
    <div className="px-4">
      <Link
        href="/relations/new"
        className="bg-primary text-primary-foreground rounded-[var(--r-lg)] p-4 flex items-center gap-3"
      >
        <UserPlus size={20} />
        <span>{t('add_relation')}</span>
      </Link>
    </div>
  );
}
