'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FeedListItem } from '@/types/relation';

async function fetchFeed(): Promise<FeedListItem[]> {
  const res = await fetch('/api/relations');
  if (!res.ok) throw new Error('FEED_FETCH_FAILED');
  const body = (await res.json()) as { items: FeedListItem[] };
  return body.items;
}

export default function FeedPage() {
  const t = useTranslations('feed');
  const tMode = useTranslations('relations.new.mode');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
  });

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

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">{t('loading')}</p>
      )}

      {isError && (
        <p className="text-sm text-destructive text-center py-8">{t('errorGeneric')}</p>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">{t('empty')}</p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {data.map((item) => (
            <li key={item.relation_id}>
              <Link
                href={`/hapcard/${item.relation_id}`}
                className="block rounded-2xl bg-card p-4 hover:bg-accent transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {item.nickname}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {tMode(item.mode)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
