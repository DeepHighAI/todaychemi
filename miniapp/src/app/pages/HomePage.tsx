/**
 * HomePage.tsx — 오늘 케미 홈 (미니앱 포트)
 *
 * 웹앱 원본:
 *  - src/app/(app)/today-page-client.tsx (메인 클라이언트 컴포넌트)
 *  - src/app/(app)/page.tsx (서버 컴포넌트 — 미니앱에서는 불필요, guard 통합)
 *
 * 변경 사항:
 *  - 'use client' 제거 (Vite SPA)
 *  - useRouter/useSearchParams → react-router-dom useNavigate/useSearchParams
 *  - next/link <Link href> → react-router <Link to>
 *  - fetch() → apiFetch() (Bearer 자동 첨부, base URL 포함)
 *  - UNAUTHORIZED 시 /onboarding 으로 이동 (미니앱 auth 흐름)
 *  - Dialog: shadcn → @base-ui/react 래퍼 (miniapp/src/components/ui/dialog.tsx)
 *  - SwipeRow: 미니앱 포트 버전
 *  - 테마 토글 없음 (라이트 모드 고정)
 *
 * API:
 *  - GET /api/today[?relation_id=...] → { ok, card }
 *  - GET /api/relations             → { items: FeedListItem[] }
 *  - GET /api/me/chart              → { ok, chart }
 *  - DELETE /api/relations/:id
 */

import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, ChevronRight, Lock } from 'lucide-react';

import { apiFetch } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useMeChart } from '../../lib/me/use-me-chart';
import { todayKST } from '../../lib/today/kst-date';
import {
  markPaidFeatureClickedToday,
  shouldShowPaidFeatureAttention,
} from '../../lib/paid-feature-attention';
import { formatTodayTemperature } from '../../lib/scoring/temperature';

import { TodayAppBar } from '../../components/today/today-app-bar';
import { DateLine } from '../../components/today/date-line';
import { TodayHero } from '../../components/today/today-hero';
import { RelationChip } from '../../components/today/relation-chip';
import { AvoidActionCards } from '../../components/today/avoid-action-cards';
import { WhatifTrigger } from '../../components/today/whatif-trigger';
import { SwipeRow } from '../../components/layout/SwipeRow';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { AdBannerListItem } from '../../components/ads/ad-banner';
import { RewardedAdCard } from '../../components/ads/rewarded-ad';

import type { DailyHapCard } from '../../types/dailyHap';
import type { FeedListItem, RelationChipItem } from '../../types/relation';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const TOP_N_RELATIONS = 5;

// ---------------------------------------------------------------------------
// 날짜 포맷
// ---------------------------------------------------------------------------

function formatKstDate(iso: string): string {
  return iso.replaceAll('-', '.');
}

// ---------------------------------------------------------------------------
// HomePage
// ---------------------------------------------------------------------------

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const t = useTranslations('home');
  const tMode = useTranslations('relations.new.mode');
  const qc = useQueryClient();
  const { token } = useAuth();

  const selectedRelationId = searchParams.get('relation_id');
  const todayDate = todayKST();

  // -------------------------------------------------------------------------
  // 쿼리 — GET /api/today
  // -------------------------------------------------------------------------

  const todayQuery = useQuery({
    queryKey: ['today', todayDate, selectedRelationId ?? ''],
    queryFn: async (): Promise<DailyHapCard> => {
      const path = selectedRelationId
        ? `/api/today?relation_id=${encodeURIComponent(selectedRelationId)}`
        : '/api/today';
      const res = await apiFetch<{ ok: boolean; card?: DailyHapCard | null }>(path, { token });
      if (!res.ok || !res.card) throw new Error('INTERNAL_ERROR');
      return res.card;
    },
  });

  // -------------------------------------------------------------------------
  // 쿼리 — GET /api/me/chart (ProfileGate 와 ['me-chart'] 캐시 공유)
  // -------------------------------------------------------------------------

  const chartQuery = useMeChart(token);

  // -------------------------------------------------------------------------
  // 쿼리 — GET /api/relations
  // -------------------------------------------------------------------------

  const relationsQuery = useQuery({
    queryKey: ['relations'],
    queryFn: async (): Promise<FeedListItem[]> => {
      try {
        const res = await apiFetch<{ items: FeedListItem[] }>('/api/relations', { token });
        return res.items ?? [];
      } catch {
        return [];
      }
    },
  });

  // -------------------------------------------------------------------------
  // Mutation — DELETE /api/relations/:id
  // -------------------------------------------------------------------------

  const del = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/relations/${id}`, { method: 'DELETE', token }),
    onSuccess: (_data, deletedId) => {
      void qc.invalidateQueries({ queryKey: ['relations'] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      if (selectedRelationId === deletedId) {
        // 삭제된 인연의 relation_id 쿼리 제거
        setSearchParams({});
      }
    },
  });

  // -------------------------------------------------------------------------
  // 로컬 상태
  // -------------------------------------------------------------------------

  const [confirmDelete, setConfirmDelete] = useState<FeedListItem | null>(null);
  const [showHapcardDot, setShowHapcardDot] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowHapcardDot(shouldShowPaidFeatureAttention('hapcard'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // 인증(미로그인)은 AuthProvider 자동 로그인 + AuthRetryGate 가, 프로필 미등록은
  // ProfileGate 가 전담한다. 따라서 홈에서 today 401 을 직접 리다이렉트하지 않는다.
  // (구 코드는 ApiError.message 를 'UNAUTHORIZED' 와 비교해 사실상 미발화하던 죽은 코드.)

  // -------------------------------------------------------------------------
  // 파생 값
  // -------------------------------------------------------------------------

  const showFallbackToday = todayQuery.isError;
  const fallbackCard: DailyHapCard = {
    headline: t('fallback.headline'),
    headline_reason: t('fallback.headline_reason'),
    avoid_phrase: t('fallback.avoid_phrase'),
    avoid_phrase_reason: t('fallback.avoid_phrase_reason'),
    favorable_action: t('fallback.favorable_action'),
    favorable_action_reason: t('fallback.favorable_action_reason'),
    reused_from_yesterday: false,
    is_fallback: true,
  };

  const card = todayQuery.data ?? (showFallbackToday ? fallbackCard : undefined);
  const chart = chartQuery.data ?? null;
  const relations = relationsQuery.data ?? [];
  const topRelations = relations.slice(0, TOP_N_RELATIONS);

  // RelationChip 에 전달할 형식 변환
  const chipRelations: RelationChipItem[] = relations.map((r) => ({
    relation_id: r.relation_id,
    nickname: r.nickname,
    mode: r.mode,
    created_at: r.created_at,
  }));

  // -------------------------------------------------------------------------
  // 렌더
  // -------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 96 }}>
      <TodayAppBar />

      {/* 로딩 */}
      {todayQuery.isLoading && (
        <div style={{ padding: '0 16px' }}>
          <LoadingState />
        </div>
      )}

      {/* 오늘 케미 카드 영역 */}
      {card && (
        <>
          {chart && (
            <DateLine date={formatKstDate(todayDate)} dayPillar={chart.day_pillar} />
          )}

          <TodayHero
            card={card}
            score={null}
            deltaVsYesterday={null}
            chipNode={
              card.relation_id && card.relation_nickname ? (
                <RelationChip
                  currentRelationId={card.relation_id}
                  currentNickname={card.relation_nickname}
                  relations={chipRelations}
                  onSelect={(relationId) => {
                    // URL 에 relation_id 반영 → today refetch
                    setSearchParams({ relation_id: relationId });
                    void qc.invalidateQueries({ queryKey: ['today'] });
                  }}
                />
              ) : null
            }
          />
          {chart && <WhatifTrigger />}
        </>
      )}

      {/* 빠른 인연 등록 카드 */}
      <section style={{ padding: '0 16px' }}>
        <Link
          to="/relations/new"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--p-90)',
            borderRadius: 'var(--r-md)',
            padding: 14,
            textDecoration: 'none',
          }}
        >
          <span style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--p-40)',
            color: 'white',
            flexShrink: 0,
          }}>
            <Plus size={22} strokeWidth={2.5} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--p-40)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('compat.eyebrow')}
            </span>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--p-10)', marginTop: 2 }}>
              {t('compat.title')}
            </span>
          </span>
          <ChevronRight size={20} style={{ color: 'var(--p-30)', flexShrink: 0 }} />
        </Link>
      </section>

      {/* 최근 인연 목록 (swipe-to-delete) */}
      {topRelations.length > 0 && (
        <section style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
              {t('recent.title')}
            </p>
            <Link to="/feed" style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
              {t('recent.viewAll')}
            </Link>
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 0, margin: 0, listStyle: 'none' }}>
            {topRelations.map((r, i) => (
              <Fragment key={r.relation_id}>
              <li>
                <SwipeRow
                  onDelete={() => setConfirmDelete(r)}
                  onClick={() => {
                    if (chartQuery.isLoading) return;
                    if (!chart) {
                      navigate('/onboarding');
                      return;
                    }
                    markPaidFeatureClickedToday('hapcard');
                    setShowHapcardDot(false);
                    navigate(`/hapcard/${r.relation_id}?mode=${encodeURIComponent(r.mode ?? '썸합')}`);
                  }}
                >
                  <div style={{
                    background: 'var(--card)',
                    borderRadius: 'var(--r-md)',
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    position: 'relative',
                  }}>
                    {showHapcardDot && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: 10,
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          backgroundColor: 'var(--destructive)',
                          boxShadow: '0 0 0 3px var(--card)',
                        }}
                      />
                    )}
                    {/* 아바타 */}
                    <div style={{
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
                    }}>
                      {r.nickname.slice(0, 2)}
                    </div>
                    {/* 텍스트 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.nickname}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.mode ? tMode(r.mode) : t('recent.uninterpreted')}
                      </p>
                    </div>
                    {/* 합온도 */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {r.compat_score !== null && r.compat_score !== undefined ? (
                        <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {formatTodayTemperature(r.compat_score)}
                        </p>
                      ) : (
                        <Lock size={18} style={{ color: 'var(--p-40)', display: 'inline-block' }} />
                      )}
                    </div>
                  </div>
                </SwipeRow>
              </li>
              {/* 인앱 광고 배너 — 목록 중간 3개마다 1개 (항목 4). 광고 미지원/미설정 시 숨김. */}
              {(i + 1) % 3 === 0 && i < topRelations.length - 1 && <AdBannerListItem />}
              </Fragment>
            ))}
          </ul>
        </section>
      )}

      {/* 피할 말 + 좋은 행동 카드 */}
      {card && <AvoidActionCards card={card} />}

      {/* 인앱토스 리워드 광고 — 사용자가 누를 때만 전면형 보상 광고 노출 */}
      <RewardedAdCard />

      {/* 삭제 확인 다이얼로그 (공용 ConfirmDialog) */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete ? t('delete.confirmTitle', { nickname: confirmDelete.nickname }) : ''}
        description={t('delete.confirmBody')}
        confirmLabel={t('delete.confirm')}
        cancelLabel={t('delete.cancel')}
        variant="destructive"
        isPending={del.isPending}
        onConfirm={() => {
          if (confirmDelete) del.mutate(confirmDelete.relation_id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
