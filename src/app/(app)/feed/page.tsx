'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChangeBadge } from '@/components/feed/ChangeBadge';
import type { FeedItem } from '@/types/relation';

type FilterMode = 'all' | '썸합' | '일합' | '친구합';

export async function fetchFeed(): Promise<FeedItem[]> {
  const res = await fetch('/api/feed');
  if (!res.ok) throw new Error('FEED_FETCH_FAILED');
  const body = (await res.json()) as { items: FeedItem[] };
  return body.items;
}

export default function FeedPage() {
  const t = useTranslations('feed');
  const tMode = useTranslations('relations.new.mode');

  const [activeFilter, setActiveFilter] = useState<FilterMode>('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
  });

  const filters = useMemo<{ value: FilterMode; label: string }[]>(
    () => [
      { value: 'all', label: t('filter.all') },
      { value: '썸합', label: tMode('썸합') },
      { value: '일합', label: tMode('일합') },
      { value: '친구합', label: tMode('친구합') },
    ],
    [t, tMode],
  );

  const displayedItems = useMemo(
    () =>
      data && activeFilter !== 'all'
        ? data.filter((item) => item.mode === activeFilter)
        : (data ?? []),
    [data, activeFilter],
  );

  return (
    <main className="bg-background min-h-screen pb-32 px-4">
      <header className="pt-8 pb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t('title')}</h1>
        <Link href="/relations/new">
          <Button type="button" variant="default" className="h-9 px-3">
            {t('addRelation')}
          </Button>
        </Link>
      </header>

      {/* Seg 필터 바 — UIDesign screens-feed.jsx:10-13 */}
      <div role="radiogroup" className="flex bg-[var(--surface-2)] rounded-[var(--r-md)] p-[3px] gap-[2px] mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={activeFilter === f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`flex-1 text-center py-[10px] text-[13px] font-semibold rounded-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-40)] focus-visible:ring-offset-1 ${
              activeFilter === f.value
                ? 'bg-[var(--surface)] text-[var(--on-surface)] shadow-[var(--e-1)]'
                : 'text-[var(--on-surface-var)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">{t('loading')}</p>
      )}

      {isError && (
        <p className="text-sm text-destructive text-center py-8">{t('errorGeneric')}</p>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <div className="rounded-2xl bg-card p-6 text-center mt-8">
          <p className="text-sm text-muted-foreground mb-4">{t('empty')}</p>
          <Link href="/relations/new">
            <Button type="button" variant="default" className="h-10 px-4">
              {t('emptyCta')}
            </Button>
          </Link>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && displayedItems.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{t('emptyFilter')}</p>
      )}

      {!isLoading && !isError && data && displayedItems.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {displayedItems.map((item) => (
            <li key={item.relation_id}>
              <Link
                href={`/hapcard/${item.relation_id}?mode=${encodeURIComponent(item.mode)}`}
                className="block rounded-2xl bg-card p-4 hover:bg-accent transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {item.nickname}
                  </span>
                  <ChangeBadge significant={item.has_significant_change} changeScore={item.change_score} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  {tMode(item.mode)}
                </Badge>
                {item.compat_score !== null && (
                  <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
                    {item.compat_score}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
