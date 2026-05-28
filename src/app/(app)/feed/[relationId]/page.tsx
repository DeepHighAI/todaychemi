'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { RelationFlowChart } from '@/components/relation/relation-flow-chart';
import { MemoList } from '@/components/memo/memo-list';
import { MemoSheet } from '@/components/memo/memo-sheet';
import { convertHanja } from '@/lib/glossary/post-process';
import { computeChangeScore } from '@/lib/scoring/changeScore';
import { formatTodayTemperature, formatTemperatureDelta } from '@/lib/scoring/temperature';
import type { RelationDetailResponse } from '@/types/relation';
import type { MemoItem, MemoListResponse } from '@/types/memo';

async function fetchRelationDetail(id: string): Promise<RelationDetailResponse> {
  const res = await fetch(`/api/relations/${id}`);
  if (!res.ok) throw new Error('FETCH_FAILED');
  return res.json() as Promise<RelationDetailResponse>;
}

async function fetchMemos(id: string): Promise<MemoListResponse> {
  const res = await fetch(`/api/relations/${id}/memos`);
  if (!res.ok) throw new Error('FETCH_FAILED');
  return res.json() as Promise<MemoListResponse>;
}

export default function RelationDetailPage() {
  const { relationId } = useParams<{ relationId: string }>();
  const router = useRouter();
  const t = useTranslations('relations.detail');
  const tMode = useTranslations('relations.new.mode');
  const queryClient = useQueryClient();

  // 메모 Sheet 로컬 상태
  const [memoSheetOpen, setMemoSheetOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState<MemoItem | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['relation-detail', relationId],
    queryFn: () => fetchRelationDetail(relationId),
    retry: false,
  });

  const { data: memosData } = useQuery({
    queryKey: ['relation-memos', relationId],
    queryFn: () => fetchMemos(relationId),
    retry: false,
  });

  // LOCKED (island.md:183): 메모 뮤테이션은 ['relation-detail'] / ['feed'] 를 절대 무효화하지 않음
  // — compat_score 에 0 영향 보장
  const createMemo = useMutation({
    mutationFn: (body: string) =>
      fetch(`/api/relations/${relationId}/memos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relation-memos', relationId] }),
  });

  const updateMemo = useMutation({
    mutationFn: ({ memoId, body }: { memoId: string; body: string }) =>
      fetch(`/api/memos/${memoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relation-memos', relationId] }),
  });

  const deleteMemo = useMutation({
    mutationFn: (memoId: string) =>
      fetch(`/api/memos/${memoId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relation-memos', relationId] }),
  });

  function handleMemoSubmit(body: string) {
    if (editingMemo) {
      updateMemo.mutate({ memoId: editingMemo.memo_id, body }, {
        onSuccess: () => { setMemoSheetOpen(false); setEditingMemo(null); },
      });
    } else {
      createMemo.mutate(body, {
        onSuccess: () => setMemoSheetOpen(false),
      });
    }
  }

  function openEditSheet(memo: MemoItem) {
    setEditingMemo(memo);
    setMemoSheetOpen(true);
  }

  function openCreateSheet() {
    setEditingMemo(null);
    setMemoSheetOpen(true);
  }

  if (isLoading) {
    return (
      <div data-testid="relation-detail-skeleton" className="bg-background min-h-screen px-4 pt-8 pb-32 space-y-4 animate-pulse">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8 pb-32">
        <ErrorCard code="INTERNAL_ERROR" />
      </main>
    );
  }

  const { relation, chart, flow } = data;
  const lastScore = flow.length > 0 ? flow[flow.length - 1].score : null;
  const prevScore = flow.length > 1 ? flow[flow.length - 2].score : null;
  const changeScore = lastScore !== null ? computeChangeScore(prevScore ?? null, lastScore) : 0;

  function handleCta() {
    router.push(`/hapcard/${relation.relation_id}?mode=${encodeURIComponent(relation.mode)}`);
  }

  const memos = memosData?.items ?? [];
  const isSubmitting = createMemo.isPending || updateMemo.isPending;

  return (
    <main className="bg-background min-h-screen pb-32">
      {/* AppBar */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md flex items-center gap-3 px-4 py-3 border-b border-[var(--surface-2)]">
        <button type="button" onClick={() => router.back()} className="p-1 -ml-1 text-foreground" aria-label="뒤로">
          ←
        </button>
        <h1 className="font-h3 text-foreground truncate flex-1">{relation.nickname}</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* 인연 요약 카드 */}
        <div className="rounded-2xl bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-h2 text-foreground">{relation.nickname}</span>
            <Badge variant="secondary">{tMode(relation.mode)}</Badge>
          </div>
          {lastScore !== null && (
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-2xl tabular-nums text-foreground">
                {formatTodayTemperature(lastScore)}
              </span>
              {changeScore !== 0 && (
                <span className={`text-sm font-bold ${changeScore > 0 ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}`}>
                  {changeScore > 0 ? '↑' : '↓'} {formatTemperatureDelta(changeScore)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 합흐름 그래프 */}
        <RelationFlowChart points={flow} />

        {/* 본명식 요약 (chart 있을 때만) */}
        {chart && (
          <div data-testid="relation-chart-section" className="rounded-2xl bg-card p-4">
            <p className="font-eyebrow text-muted-foreground mb-2">{t('chart')}</p>
            <p className="font-body text-foreground">{convertHanja(chart.day_pillar)}</p>
          </div>
        )}

        {/* 메모 섹션 — LOCKED: 이 섹션의 CRUD 는 점수에 0 영향 (island.md:183) */}
        <div className="rounded-2xl bg-card p-4 space-y-3">
          <MemoList
            items={memos}
            onEdit={openEditSheet}
            onDelete={(memoId) => deleteMemo.mutate(memoId)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={openCreateSheet}
          >
            {t('memos.add')}
          </Button>
        </div>

        {/* CTA */}
        <Button type="button" className="w-full h-12" onClick={handleCta}>
          {t('cta')}
        </Button>
      </div>

      {/* 메모 입력 Sheet */}
      {/* key로 editingMemo 변경 시 remount → initialBody 초기화 */}
      <MemoSheet
        key={editingMemo ? editingMemo.memo_id : 'create'}
        open={memoSheetOpen}
        onOpenChange={setMemoSheetOpen}
        mode={editingMemo ? 'edit' : 'create'}
        initialBody={editingMemo?.body ?? ''}
        onSubmit={handleMemoSubmit}
        submitting={isSubmitting}
      />
    </main>
  );
}
