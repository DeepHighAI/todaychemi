/**
 * RelationDetailPage.tsx — 인연 디테일 + 타임라인 (미니앱 포트)
 *
 * 웹앱 원본: src/app/(app)/feed/[relationId]/page.tsx
 * 변경:
 *   - 'use client' 제거 (Vite SPA)
 *   - useParams(next) → useParams(react-router-dom)
 *   - useRouter(next) → useNavigate
 *   - fetch('/api/...') → apiFetch + Bearer 토큰
 *   - Tailwind → 인라인 스타일
 *   - MemoList/MemoSheet → MemoSection (miniapp 포트 인라인)
 *   - RelationFlowChart/RelationTimeline → miniapp 포트
 *
 * 케미카드 보기 CTA → /hapcard/:relationId?mode=...
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BackButton } from '@/components/ui/back-button';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { RelationFlowChart } from '@/components/relation/RelationFlowChart';
import { RelationTimeline } from '@/components/relation/RelationTimeline';
import { MemoSection } from '@/components/feed/MemoSection';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { convertHanja } from '@/lib/glossary/post-process';
import {
  DETAILED_TEMPERATURE_PRECISION,
  formatTemperatureDeltaBetweenScores,
  formatTodayTemperature,
  temperatureDeltaBetweenScores,
} from '@/lib/scoring/temperature';
import type { RelationDetailResponse, MemoListResponse } from '@/types/relation';

export function RelationDetailPage() {
  const { relationId } = useParams<{ relationId: string }>();
  const navigate = useNavigate();
  const t = useTranslations('relations.detail');
  const tMode = useTranslations('relations.new.mode');
  const queryClient = useQueryClient();
  const { token } = useAuth();

  // relationId 없는 경우는 라우터가 보장하지만 TypeScript 안전 처리
  const id = relationId ?? '';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['relation-detail', id],
    queryFn: () => apiFetch<RelationDetailResponse>(`/api/relations/${id}`, { token }),
    retry: false,
  });

  const { data: memosData } = useQuery({
    queryKey: ['relation-memos', id],
    queryFn: () => apiFetch<MemoListResponse>(`/api/relations/${id}/memos`, { token }),
    retry: false,
  });

  // LOCKED (island.md:183): 메모 뮤테이션은 ['relation-detail'] / ['feed'] 를 절대 무효화하지 않음
  const createMemo = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/relations/${id}/memos`, {
        method: 'POST',
        token,
        body: { body },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relation-memos', id] }),
  });

  const updateMemo = useMutation({
    mutationFn: ({ memoId, body }: { memoId: string; body: string }) =>
      apiFetch(`/api/memos/${memoId}`, {
        method: 'PATCH',
        token,
        body: { body },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relation-memos', id] }),
  });

  const deleteMemo = useMutation({
    mutationFn: (memoId: string) =>
      apiFetch(`/api/memos/${memoId}`, { method: 'DELETE', token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relation-memos', id] }),
  });

  // 로딩 스켈레톤
  if (isLoading) {
    return (
      <div
        data-testid="relation-detail-skeleton"
        style={{
          backgroundColor: 'var(--background)',
          minHeight: '100%',
          padding: '32px 16px 128px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          opacity: 0.6,
        }}
      >
        <div style={{ height: 24, width: 128, borderRadius: 4, backgroundColor: 'var(--muted)' }} />
        <div style={{ height: 96, borderRadius: 16, backgroundColor: 'var(--muted)' }} />
        <div style={{ height: 80, borderRadius: 16, backgroundColor: 'var(--muted)' }} />
      </div>
    );
  }

  // 에러
  if (isError || !data) {
    return (
      <main
        style={{
          backgroundColor: 'var(--background)',
          minHeight: '100%',
          padding: '32px 16px 128px',
        }}
      >
        <ErrorCard code="INTERNAL_ERROR" />
      </main>
    );
  }

  const { relation, chart, flow } = data;
  const lastScore = flow.length > 0 ? flow[flow.length - 1].score : null;
  const prevScore = flow.length > 1 ? flow[flow.length - 2].score : null;
  const temperatureDelta =
    lastScore !== null
      ? temperatureDeltaBetweenScores(prevScore, lastScore, DETAILED_TEMPERATURE_PRECISION)
      : 0;

  const memos = memosData?.items ?? [];
  const isSubmitting = createMemo.isPending || updateMemo.isPending;

  return (
    <main
      style={{
        backgroundColor: 'var(--background)',
        minHeight: '100%',
        paddingBottom: 128,
      }}
    >
      {/* AppBar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          // rgba(var(--background)…) 는 토큰이 hex 라 무효 → color-mix 로 80% 불투명 틴트.
          backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        <BackButton onClick={() => navigate(-1)} />
        <h1
          style={{
            margin: 0,
            flex: 1,
            font: 'var(--t-h3)',
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {relation.nickname}
        </h1>
      </header>

      <div
        style={{
          padding: '16px 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* 인연 요약 카드 */}
        <div
          style={{
            borderRadius: 'var(--r-lg)',
            backgroundColor: 'var(--card)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ font: 'var(--t-h2)', color: 'var(--foreground)' }}>{relation.nickname}</span>
            <Badge variant="secondary">{tMode(relation.mode)}</Badge>
          </div>
          {lastScore !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 24,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--foreground)',
                }}
              >
                {formatTodayTemperature(lastScore, DETAILED_TEMPERATURE_PRECISION)}
              </span>
              {temperatureDelta !== 0 && (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: temperatureDelta > 0 ? 'var(--ok)' : 'var(--warn)',
                  }}
                >
                  {temperatureDelta > 0 ? '↑' : '↓'}{' '}
                  {formatTemperatureDeltaBetweenScores(prevScore, lastScore, DETAILED_TEMPERATURE_PRECISION)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 합흐름 그래프 */}
        <RelationFlowChart points={flow} />

        {/* 이력 타임라인 (S-09 H-1) — 등록·해석·다시맞추기 시간순 (최신순) */}
        <RelationTimeline relationId={relation.relation_id} />

        {/* 본명식 요약 (chart 있을 때만) */}
        {chart && (
          <div
            data-testid="relation-chart-section"
            style={{
              borderRadius: 'var(--r-lg)',
              backgroundColor: 'var(--card)',
              padding: 16,
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--muted-foreground)',
              }}
            >
              {t('chart')}
            </p>
            <p style={{ margin: 0, font: 'var(--t-body)', color: 'var(--foreground)' }}>
              {convertHanja(chart.day_pillar)}
            </p>
          </div>
        )}

        {/* 메모 섹션 — LOCKED: 이 섹션의 CRUD 는 점수에 0 영향 (island.md:183) */}
        <MemoSection
          items={memos}
          isSubmitting={isSubmitting}
          onCreate={(body) => createMemo.mutate(body)}
          onEdit={(body, memoId) => updateMemo.mutate({ memoId, body })}
          onDelete={(memoId) => deleteMemo.mutate(memoId)}
        />

        {/* CTA — 케미카드 보기 (풀폭 pill 프라이머리, 글로우 강조) */}
        <Button
          type="button"
          size="cta"
          className="btn-cta"
          onClick={() =>
            navigate(`/hapcard/${relation.relation_id}?mode=${encodeURIComponent(relation.mode)}`)
          }
        >
          {t('cta')}
        </Button>
      </div>
    </main>
  );
}
