/**
 * FeedPage.tsx — 케미피드 (미니앱 포트)
 *
 * 웹앱 원본: src/app/(app)/feed/page.tsx
 * 변경:
 *   - 'use client' 제거 (Vite SPA)
 *   - next/link → react-router-dom Link (to=)
 *   - useRouter(next) → useNavigate
 *   - useSearchParams(next) → useSearchParams(react-router-dom)
 *   - fetch('/api/feed') → apiFetch + Bearer 토큰
 *   - useRelationDraft (zustand, next/navigation 없음) → 미포함 (draft 정리 생략, miniapp은 결제가 웹앱에서 진행 후 redirect 없음)
 *   - lucide-react: Check, Plus, Trash2 → 인라인 SVG
 *   - Tailwind 클래스 → 인라인 스타일
 *   - SwipeRow → 로컬 miniapp 포트
 *
 * Toss IAP 결제는 web-app에서 처리 후 redirect 없이 확인.
 * Pay-per-use 402 분기는 HapcardPage 에서 처리 (피드는 메타데이터만).
 */

import { Fragment, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Seg } from '@/components/ui/seg';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SwipeRow } from '@/components/layout/SwipeRow';
import { AdBannerListItem } from '@/components/ads/ad-banner';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatTemperatureDelta, formatTodayTemperature } from '@/lib/scoring/temperature';
import type { FeedItem, Mode } from '@/types/relation';

// -----------------------------------------------------------------------
// 필터 타입
// -----------------------------------------------------------------------

type FilterMode = 'all' | Mode;

// -----------------------------------------------------------------------
// 컴포넌트
// -----------------------------------------------------------------------

export function FeedPage() {
  const t = useTranslations('feed');
  const tMode = useTranslations('relations.new.mode');
  const tFilter = useTranslations('feed.filter.modes');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusedRelationId = searchParams.get('focus');
  const qc = useQueryClient();
  const { token } = useAuth();

  const [activeFilter, setActiveFilter] = useState<FilterMode>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState<FeedItem[] | null>(null);

  // ----- 데이터 fetching -----
  const { data, isLoading, isError } = useQuery({
    queryKey: ['feed', focusedRelationId ?? ''],
    queryFn: () =>
      apiFetch<{ items: FeedItem[] }>('/api/feed', { token }).then((r) => r.items),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiFetch(`/api/relations/${id}`, { method: 'DELETE', token });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['relations'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });

  // ----- 필터 옵션 -----
  const filters = useMemo<{ value: FilterMode; label: string }[]>(
    () => [
      { value: 'all', label: t('filter.all') },
      { value: '일합', label: tFilter('일합') },
      { value: '친구합', label: tFilter('친구합') },
      { value: '돈합', label: tFilter('돈합') },
      { value: '첫합', label: tFilter('첫합') },
      { value: '썸합', label: tFilter('썸합') },
      { value: '오래합', label: tFilter('오래합') },
    ],
    [t, tFilter],
  );

  // ----- 정렬·필터 -----
  const items = useMemo(() => {
    const feedItems = data ?? [];
    if (!focusedRelationId) return feedItems;
    const focused = feedItems.find((item) => item.relation_id === focusedRelationId);
    if (!focused) return feedItems;
    return [focused, ...feedItems.filter((item) => item.relation_id !== focusedRelationId)];
  }, [data, focusedRelationId]);

  const filtered = activeFilter === 'all' ? items : items.filter((i) => i.mode === activeFilter);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.relation_id)),
    [items, selectedIds],
  );

  // 오늘 변화 큼 인연 1개 강조 카드
  const highlight = useMemo(() => items.find((i) => i.has_significant_change), [items]);
  const rest = highlight ? filtered.filter((i) => i.relation_id !== highlight.relation_id) : filtered;

  // ----- 핸들러 -----
  const handleRowClick = useCallback(
    (item: FeedItem) => {
      if (selectionMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.relation_id)) next.delete(item.relation_id);
          else next.add(item.relation_id);
          return next;
        });
        return;
      }
      navigate(`/feed/${item.relation_id}`);
    },
    [navigate, selectionMode],
  );

  const startSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const cancelSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const changeFilter = useCallback((value: FilterMode) => {
    setActiveFilter(value);
    setSelectedIds(new Set());
  }, []);

  const confirmSelectedDelete = useCallback(() => {
    if (selectedItems.length === 0) return;
    setConfirmDelete(selectedItems);
  }, [selectedItems]);

  const submitDelete = useCallback(
    (targets: FeedItem[]) => {
      del.mutate(
        targets.map((item) => item.relation_id),
        {
          onSuccess: () => {
            setConfirmDelete(null);
            setSelectedIds(new Set());
            setSelectionMode(false);
          },
        },
      );
    },
    [del],
  );

  // ----- 선택 체크 마크 -----
  const renderSelectionMark = (item: FeedItem) => {
    if (!selectionMode) return null;
    const selected = selectedIds.has(item.relation_id);
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          width: 28,
          height: 28,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
          backgroundColor: selected ? 'var(--primary)' : 'var(--background)',
          color: selected ? 'var(--primary-foreground)' : 'transparent',
        }}
      >
        <Check size={16} aria-hidden="true" />
      </span>
    );
  };

  // ----- 행 콘텐츠 -----
  const renderRowContent = (item: FeedItem) => (
    <div
      className="card-elevated"
      style={{
        backgroundColor: 'var(--card)',
        borderRadius: 'var(--r-md)',
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        outline: selectedIds.has(item.relation_id) ? '2px solid var(--primary)' : 'none',
        outlineOffset: -2,
      }}
    >
      {renderSelectionMark(item)}
      {/* 아바타 */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 13,
          flexShrink: 0,
          background: 'var(--p-90)',
          color: 'var(--p-10)',
        }}
      >
        {item.nickname.slice(0, 2)}
      </div>
      {/* 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.nickname}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: 12,
            color: 'var(--muted-foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tMode(item.mode)}
        </p>
      </div>
      {/* 케미온도 */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {item.compat_score !== null ? (
          <p
            style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 16,
              lineHeight: 1,
              color: 'var(--foreground)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTodayTemperature(item.compat_score)}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>—</p>
        )}
        {typeof item.change_score === 'number' && item.change_score !== 0 && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 10,
              fontWeight: 700,
              color: item.change_score > 0 ? 'var(--ok)' : 'var(--warn)',
            }}
          >
            {item.change_score > 0 ? '↑' : '↓'} {formatTemperatureDelta(item.change_score)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <main
      style={{
        backgroundColor: 'var(--background)',
        minHeight: '100%',
        paddingBottom: 128,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          paddingTop: 32,
          paddingBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ margin: 0, font: 'var(--t-h1)', letterSpacing: 'var(--ls-tight)', color: 'var(--foreground)' }}>
          {t('title')}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {items.length > 0 && (
            <Button
              type="button"
              variant={selectionMode ? 'secondary' : 'outline'}
              size="sm"
              style={{ gap: 6 }}
              onClick={selectionMode ? cancelSelectionMode : startSelectionMode}
            >
              <Trash2 size={16} aria-hidden="true" />
              {selectionMode ? t('select.cancel') : t('select.start')}
            </Button>
          )}
          <Link to="/relations/new" style={{ textDecoration: 'none' }}>
            <Button type="button" variant="default" size="sm" style={{ gap: 6 }}>
              <Plus size={16} aria-hidden="true" />
              {t('addRelation')}
            </Button>
          </Link>
        </div>
      </header>

      {/* 세그먼트 필터 바 (공용 Seg) */}
      <Seg
        options={filters}
        value={activeFilter}
        onChange={changeFilter}
        variant="segment"
        scrollable
        ariaLabel="모드 필터"
        style={{ marginBottom: 16 }}
      />

      {/* 로딩/에러 상태 */}
      {isLoading && (
        <p style={{ font: 'var(--t-sub)', color: 'var(--muted-foreground)', textAlign: 'center', padding: '32px 0' }}>
          {t('loading')}
        </p>
      )}
      {isError && (
        <p style={{ font: 'var(--t-sub)', color: 'var(--destructive)', textAlign: 'center', padding: '32px 0' }}>
          {t('errorGeneric')}
        </p>
      )}

      {/* 인연 0건 빈 상태 */}
      {!isLoading && !isError && items.length === 0 && (
        <div
          style={{
            borderRadius: 'var(--r-lg)',
            backgroundColor: 'var(--card)',
            padding: 24,
            textAlign: 'center',
            marginTop: 32,
          }}
        >
          <p style={{ font: 'var(--t-sub)', color: 'var(--muted-foreground)', marginBottom: 16 }}>
            {t('empty')}
          </p>
          <Link to="/relations/new" style={{ textDecoration: 'none' }}>
            <Button type="button" variant="default" size="cta" className="btn-cta">
              {t('emptyCta')}
            </Button>
          </Link>
        </div>
      )}

      {/* 선택 삭제 툴바 */}
      {selectionMode && items.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--card)',
            padding: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
            {t('select.count', { count: selectedIds.size })}
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            style={{ gap: 6 }}
            disabled={selectedIds.size === 0}
            onClick={confirmSelectedDelete}
          >
            <Trash2 size={16} aria-hidden="true" />
            {t('select.delete')}
          </Button>
        </div>
      )}

      {/* 오늘 변화 큼 강조 카드 — mini Liquid Glass */}
      {highlight && (activeFilter === 'all' || highlight.mode === activeFilter) && (
        selectionMode ? (
          <button
            type="button"
            aria-pressed={selectedIds.has(highlight.relation_id)}
            aria-label={t('select.itemLabel', { nickname: highlight.nickname })}
            onClick={() => handleRowClick(highlight)}
            style={{
              display: 'block',
              width: '100%',
              borderRadius: 'var(--r-xl)',
              padding: 16,
              marginBottom: 12,
              position: 'relative',
              overflow: 'hidden',
              textAlign: 'left',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #0066FF 0%, #6541F2 50%, #9333EA 110%)',
              outline: selectedIds.has(highlight.relation_id) ? '2px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: -2,
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.30), transparent 50%)',
              }}
            />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ⚡ {t('change.eyebrow')}
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: 800, fontSize: 18, lineHeight: 1.2, letterSpacing: '-0.018em', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {highlight.nickname}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  {tMode(highlight.mode)} · {formatTemperatureDelta(highlight.change_score ?? 0)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {renderSelectionMark(highlight)}
                <span style={{ fontWeight: 800, fontSize: 32, lineHeight: 1, letterSpacing: '-0.04em', color: '#fff' }}>↗</span>
              </div>
            </div>
          </button>
        ) : (
          <Link
            to={`/feed/${highlight.relation_id}`}
            style={{
              display: 'block',
              borderRadius: 'var(--r-xl)',
              padding: 16,
              marginBottom: 12,
              position: 'relative',
              overflow: 'hidden',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #0066FF 0%, #6541F2 50%, #9333EA 110%)',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.30), transparent 50%)',
              }}
            />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ⚡ {t('change.eyebrow')}
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: 800, fontSize: 18, lineHeight: 1.2, letterSpacing: '-0.018em', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {highlight.nickname}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  {tMode(highlight.mode)} · {formatTemperatureDelta(highlight.change_score ?? 0)}
                </p>
              </div>
              <span style={{ fontWeight: 800, fontSize: 32, lineHeight: 1, letterSpacing: '-0.04em', color: '#fff' }}>↗</span>
            </div>
          </Link>
        )
      )}

      {/* 필터 결과 없음 */}
      {!isLoading && !isError && filtered.length === 0 && items.length > 0 && (
        <p style={{ font: 'var(--t-sub)', color: 'var(--muted-foreground)', textAlign: 'center', padding: '32px 0' }}>
          {t('emptyFilter')}
        </p>
      )}

      {/* 인연 리스트 — swipe-to-delete */}
      {rest.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rest.map((item, i) => (
            <Fragment key={item.relation_id}>
            <li>
              {selectionMode ? (
                <button
                  type="button"
                  aria-pressed={selectedIds.has(item.relation_id)}
                  aria-label={t('select.itemLabel', { nickname: item.nickname })}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => handleRowClick(item)}
                >
                  {renderRowContent(item)}
                </button>
              ) : (
                <SwipeRow
                  onDelete={() => setConfirmDelete([item])}
                  onClick={() => handleRowClick(item)}
                >
                  {renderRowContent(item)}
                </SwipeRow>
              )}
            </li>
            {/* 인앱 광고 배너 — 목록 중간 4개마다 1개 (항목 4). 선택 모드·광고 미지원/미설정 시 숨김. */}
            {!selectionMode && (i + 1) % 4 === 0 && i < rest.length - 1 && <AdBannerListItem />}
            </Fragment>
          ))}
        </ul>
      )}

      {/* 삭제 확인 다이얼로그 (공용 ConfirmDialog) */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={
          confirmDelete
            ? confirmDelete.length === 1
              ? t('delete.confirmTitle', { nickname: confirmDelete[0].nickname })
              : t('delete.bulkConfirmTitle', { count: confirmDelete.length })
            : ''
        }
        description={t('delete.confirmBody')}
        confirmLabel={del.isPending ? t('delete.deleting') : t('delete.confirm')}
        cancelLabel={t('delete.cancel')}
        variant="destructive"
        isPending={del.isPending}
        onConfirm={() => {
          if (confirmDelete) submitDelete(confirmDelete);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </main>
  );
}
