'use client';

/* Today page — Liquid Glass hero with score + delta + swipe-to-delete relations
 * Canvas reference: type-d/screens-interactive.jsx::IHome
 *
 * Improvements:
 *  - TodayHero에 compat_score 전달 → 56px 큰 숫자 + delta pill
 *  - 인연 row를 SwipeRow로 — 좌측 스와이프 시 삭제
 *  - 빠른 인연 등록 카드 prominent하게
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Plus, ChevronRight, Lock } from 'lucide-react';

import { TodayAppBar } from '@/components/today/today-app-bar';
import { DateLine } from '@/components/today/date-line';
import { TodayHero } from '@/components/today/today-hero';
import { AvoidActionCards } from '@/components/today/avoid-action-cards';
import { WhatifTrigger } from '@/components/today/whatif-trigger';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { SwipeRow } from '@/components/layout/swipe-row';

import { todayKST } from '@/lib/today/kst-date';
import { isErrorCode, type ErrorCode } from '@/lib/errors/error-codes';
import type { DailyHapCard } from '@/types/dailyHap';
import type { ChartCore } from '@/types/chart';
import type { FeedListItem } from '@/types/relation';

const TOP_N_RELATIONS = 5;

async function fetchToday(): Promise<DailyHapCard> {
  const res = await fetch('/api/today');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = (body as { error?: { code?: string } })?.error?.code ?? 'INTERNAL_ERROR';
    throw new Error(code);
  }
  const body = (await res.json()) as { ok: boolean; card?: DailyHapCard };
  if (!body.ok || !body.card) throw new Error('INTERNAL_ERROR');
  return body.card;
}

async function fetchMyChart(): Promise<ChartCore | null> {
  const res = await fetch('/api/me/chart');
  if (!res.ok) return null;
  const body = (await res.json()) as { ok: boolean; chart: ChartCore | null };
  return body.chart ?? null;
}

async function fetchRelations(): Promise<FeedListItem[]> {
  const res = await fetch('/api/relations');
  if (!res.ok) return [];
  const body = (await res.json()) as { items: FeedListItem[] };
  return body.items;
}

async function deleteRelation(id: string) {
  const res = await fetch(`/api/relations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('DELETE_FAILED');
}

function formatKstDate(iso: string): string {
  return iso.replaceAll('-', '.');
}

export default function TodayPage() {
  const router = useRouter();
  const t = useTranslations('home');
  const tMode = useTranslations('relations.new.mode');
  const qc = useQueryClient();

  const todayQuery = useQuery({ queryKey: ['today'], queryFn: fetchToday });
  const chartQuery = useQuery({ queryKey: ['me-chart'], queryFn: fetchMyChart });
  const relationsQuery = useQuery({ queryKey: ['relations'], queryFn: fetchRelations });

  const del = useMutation({
    mutationFn: deleteRelation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relations'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const [confirmDelete, setConfirmDelete] = useState<FeedListItem | null>(null);

  const card = todayQuery.data;
  const chart = chartQuery.data ?? null;
  const relations = relationsQuery.data ?? [];

  const todayErrorMsg = todayQuery.error?.message;
  const todayErrorCode: ErrorCode = isErrorCode(todayErrorMsg) ? todayErrorMsg : 'INTERNAL_ERROR';

  useEffect(() => {
    if (todayQuery.isError && todayErrorMsg === 'UNAUTHORIZED') router.push('/login');
  }, [todayQuery.isError, todayErrorMsg, router]);

  const topRelations = relations.slice(0, TOP_N_RELATIONS);

  return (
    <div className="space-y-4 pb-24">
      <TodayAppBar />

      {todayQuery.isLoading && (
        <div className="px-4"><LoadingState /></div>
      )}

      {todayQuery.isError && todayErrorMsg !== 'UNAUTHORIZED' && (
        <div className="px-4">
          <ErrorCard code={todayErrorCode} onRetry={() => todayQuery.refetch()} />
        </div>
      )}

      {card && (
        <>
          {chart && <DateLine date={formatKstDate(todayKST())} dayPillar={chart.day_pillar} />}

          {/* canvas hero: 큰 점수 + delta pill */}
          <TodayHero
            card={card}
            score={card.compat_score ?? card.headline_strength ?? null}
            deltaVsYesterday={card.delta_vs_yesterday ?? null}
          />

          {/* 빠른 인연 등록 카드 (canvas IHome) */}
          <section className="px-4">
            <Link href="/relations/new"
              className="flex items-center gap-3 bg-[var(--p-90)] rounded-[var(--r-md)] p-3.5 active:scale-[0.99] transition">
              <span className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                style={{ background: 'var(--p-40)', color: 'white' }}>
                <Plus size={22} strokeWidth={2.5} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-eyebrow block text-[var(--p-40)]">{t('compat.eyebrow')}</span>
                <span className="font-bold text-[14px] text-[var(--p-10)] block mt-0.5">{t('compat.title')}</span>
              </span>
              <ChevronRight size={20} className="text-[var(--p-30)] shrink-0" />
            </Link>
          </section>

          {/* 인연 리스트 — swipe-to-delete */}
          {topRelations.length > 0 && (
            <section className="px-4 space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="font-eyebrow text-muted-foreground">{t('recent.title')}</p>
                <Link href="/feed" className="text-[12px] font-semibold text-primary">{t('recent.viewAll')}</Link>
              </div>
              <ul className="space-y-2">
                {topRelations.map((r) => (
                  <li key={r.relation_id}>
                    <SwipeRow
                      onDelete={() => setConfirmDelete(r)}
                      onClick={() => router.push(`/hapcard/${r.relation_id}?mode=${encodeURIComponent(r.mode ?? '썸합')}`)}
                    >
                      <div className="bg-card rounded-[var(--r-md)] p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center font-bold text-[13px] shrink-0"
                          style={{ background: 'var(--p-90)', color: 'var(--p-10)' }}>
                          {r.nickname.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[14px] text-foreground truncate">{r.nickname}</p>
                          <p className="text-[12px] text-muted-foreground truncate">
                            {r.mode ? tMode(r.mode) : t('recent.uninterpreted')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {r.compat_score !== null && r.compat_score !== undefined ? (
                            <p className="font-display font-extrabold text-[18px] leading-none text-foreground tabular-nums">{r.compat_score}</p>
                          ) : (
                            <Lock size={18} className="text-[var(--p-40)] inline-block" />
                          )}
                        </div>
                      </div>
                    </SwipeRow>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <AvoidActionCards card={card} />
          {chart && <WhatifTrigger />}
        </>
      )}

      {/* 삭제 확인 다이얼로그 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-6"
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-card rounded-[20px] p-5 w-full max-w-[320px] space-y-3"
            onClick={(e) => e.stopPropagation()}>
            <p className="font-h3 text-foreground">{t('delete.confirmTitle', { nickname: confirmDelete.nickname })}</p>
            <p className="font-sub text-muted-foreground">{t('delete.confirmBody')}</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-[12px] bg-muted text-foreground font-semibold">{t('delete.cancel')}</button>
              <button onClick={() => { del.mutate(confirmDelete.relation_id); setConfirmDelete(null); }}
                className="flex-1 py-3 rounded-[12px] bg-destructive text-white font-bold">{t('delete.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
