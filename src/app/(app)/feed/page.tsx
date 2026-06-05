'use client';

/* Feed — 1-col list with swipe-to-delete + 오늘 변화 큼 인연 강조 카드
 * Canvas reference: type-d/screens-interactive.jsx::IHome SwipeRow list
 *
 * Improvements over original 2-col grid:
 *  - Rich rows: avatar (일주 chip), 별명, 모드+시간, 오늘온도, delta
 *  - Top "오늘 변화 큼" 인연 1개를 mini Liquid Glass card로 강조
 *  - 좌측 스와이프 → 삭제 (확인 모달)
 */

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SwipeRow } from '@/components/layout/swipe-row';
import { formatTemperatureDelta, formatTodayTemperature } from '@/lib/scoring/temperature';
import type { FeedItem } from '@/types/relation';

type FilterMode = 'all' | '일합' | '친구합' | '돈합' | '첫합' | '썸합' | '오래합';

async function fetchFeed(): Promise<FeedItem[]> {
  const res = await fetch('/api/feed');
  if (!res.ok) throw new Error('FEED_FETCH_FAILED');
  const body = (await res.json()) as { items: FeedItem[] };
  return body.items;
}

async function deleteRelation(id: string) {
  const res = await fetch(`/api/relations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('DELETE_FAILED');
}

export default function FeedPage() {
  const t = useTranslations('feed');
  const tMode = useTranslations('relations.new.mode');
  const tFilter = useTranslations('feed.filter.modes');
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusedRelationId = searchParams.get('focus');
  const qc = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<FilterMode>('all');
  const [confirmDelete, setConfirmDelete] = useState<FeedItem | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feed', focusedRelationId ?? ''],
    queryFn: fetchFeed,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const del = useMutation({
    mutationFn: deleteRelation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  });

  const filters = useMemo<{ value: FilterMode; label: string }[]>(() => [
    { value: 'all', label: t('filter.all') },
    { value: '일합', label: tFilter('일합') },
    { value: '친구합', label: tFilter('친구합') },
    { value: '돈합', label: tFilter('돈합') },
    { value: '첫합', label: tFilter('첫합') },
    { value: '썸합', label: tFilter('썸합') },
    { value: '오래합', label: tFilter('오래합') },
  ], [t, tFilter]);

  const items = useMemo(() => {
    const feedItems = data ?? [];
    if (!focusedRelationId) return feedItems;

    const focused = feedItems.find(item => item.relation_id === focusedRelationId);
    if (!focused) return feedItems;

    return [
      focused,
      ...feedItems.filter(item => item.relation_id !== focusedRelationId),
    ];
  }, [data, focusedRelationId]);
  const filtered = activeFilter === 'all' ? items : items.filter(i => i.mode === activeFilter);

  // 오늘 변화 큼 인연 1개 (canvas의 cool Liquid Glass card)
  const highlight = useMemo(() => items.find(i => i.has_significant_change), [items]);
  const rest = highlight ? filtered.filter(i => i.relation_id !== highlight.relation_id) : filtered;

  const handleRowClick = useCallback((item: FeedItem) => {
    router.push(`/feed/${item.relation_id}`);
  }, [router]);

  return (
    <main className="bg-background min-h-screen pb-32 px-4">
      <header className="pt-8 pb-6 flex items-center justify-between">
        <h1 className="font-h1 text-foreground">{t('title')}</h1>
        <Link href="/relations/new">
          <Button type="button" variant="default" className="h-9 px-3 gap-1.5">
            <Plus size={16} />
            {t('addRelation')}
          </Button>
        </Link>
      </header>

      {/* Seg 필터 바 */}
      <div role="radiogroup" className="flex bg-[var(--surface-2)] rounded-[var(--r-md)] p-[3px] gap-[2px] mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={activeFilter === f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`flex-1 text-center py-[10px] text-[13px] font-semibold rounded-[12px] transition ${
              activeFilter === f.value
                ? 'bg-[var(--surface)] text-[var(--on-surface)] shadow-[var(--e-1)]'
                : 'text-[var(--on-surface-var)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="font-sub text-muted-foreground text-center py-8">{t('loading')}</p>}
      {isError && <p className="font-sub text-destructive text-center py-8">{t('errorGeneric')}</p>}

      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-2xl bg-card p-6 text-center mt-8">
          <p className="font-sub text-muted-foreground mb-4">{t('empty')}</p>
          <Link href="/relations/new">
            <Button type="button" variant="default" className="h-10 px-4">{t('emptyCta')}</Button>
          </Link>
        </div>
      )}

      {/* 오늘 변화 큼 강조 카드 (mini Liquid Glass) */}
      {highlight && (activeFilter === 'all' || highlight.mode === activeFilter) && (
        <Link
          href={`/feed/${highlight.relation_id}`}
          className="block rounded-[var(--r-xl)] p-4 mb-3 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0066FF 0%, #6541F2 50%, #9333EA 110%)' }}
        >
          <span aria-hidden className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.30), transparent 50%)' }} />
          <div className="relative z-[1] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white/85 uppercase tracking-[0.08em]">⚡ {t('change.eyebrow')}</p>
              <p className="font-display font-extrabold text-[18px] leading-[1.2] tracking-[-0.018em] text-white mt-1.5 truncate">{highlight.nickname}</p>
              <p className="text-[13px] text-white/85 mt-1">
                {tMode(highlight.mode)} · {formatTemperatureDelta(highlight.change_score ?? 0)}
              </p>
            </div>
            <span className="font-display font-extrabold text-[32px] leading-none tracking-[-0.04em] text-white">↗</span>
          </div>
        </Link>
      )}

      {!isLoading && !isError && filtered.length === 0 && items.length > 0 && (
        <p className="font-sub text-muted-foreground text-center py-8">{t('emptyFilter')}</p>
      )}

      {/* 리스트 — swipe-to-delete */}
      {rest.length > 0 && (
        <ul className="space-y-2">
          {rest.map((item) => (
            <li key={item.relation_id}>
              <SwipeRow
                onDelete={() => setConfirmDelete(item)}
                onClick={() => handleRowClick(item)}
              >
                <div className="bg-card rounded-[var(--r-md)] p-3 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center font-bold text-[13px] shrink-0"
                    style={{ background: 'var(--p-90)', color: 'var(--p-10)' }}
                  >
                    {item.nickname.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] text-foreground truncate">{item.nickname}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{tMode(item.mode)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {item.compat_score !== null ? (
                      <p className="font-display font-extrabold text-[16px] leading-none text-foreground tabular-nums">
                        {formatTodayTemperature(item.compat_score)}
                      </p>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">—</p>
                    )}
                    {typeof item.change_score === 'number' && item.change_score !== 0 && (
                      <p className={`text-[10px] font-bold mt-1 ${item.change_score > 0 ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}`}>
                        {item.change_score > 0 ? '↑' : '↓'} {formatTemperatureDelta(item.change_score)}
                      </p>
                    )}
                  </div>
                </div>
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}

      {/* 삭제 확인 다이얼로그 */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-6"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-card rounded-[20px] p-5 w-full max-w-[320px] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-h3 text-foreground">
              {t('delete.confirmTitle', { nickname: confirmDelete.nickname })}
            </p>
            <p className="font-sub text-muted-foreground">{t('delete.confirmBody')}</p>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmDelete(null)}
              >
                {t('delete.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  del.mutate(confirmDelete.relation_id);
                  setConfirmDelete(null);
                }}
              >
                {t('delete.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
