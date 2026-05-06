'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/feedback/EmptyState';

interface FeedRow {
  id: string;
  nickname: string;
  interpreted: boolean;
}

interface RecentFeedRowsProps {
  rows: FeedRow[];
}

export function RecentFeedRows({ rows }: RecentFeedRowsProps) {
  const t = useTranslations('home');
  return (
    <div className="px-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('recent_picks')}</p>
      {rows.length === 0 ? (
        <EmptyState title="아직 등록된 인연이 없어요." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={row.interpreted ? `/hapcard/${row.id}` : `/feed`}
              className="flex items-center justify-between bg-surface-1 rounded-[var(--r-md)] p-3"
            >
              <span className="text-sm font-medium">{row.nickname}</span>
              {!row.interpreted && (
                <Lock size={16} className="text-muted-foreground" data-testid="lock-icon" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
