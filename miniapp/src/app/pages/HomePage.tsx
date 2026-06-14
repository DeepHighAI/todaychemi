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
 *  - 테마 토글 없음 (시스템 다크모드 따름)
 *
 * API:
 *  - GET /api/today[?relation_id=...] → { ok, card }
 *  - GET /api/relations             → { items: FeedListItem[] }
 *  - GET /api/me/chart              → { ok, chart }
 *  - DELETE /api/relations/:id
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, ChevronRight, Lock } from 'lucide-react';

import { apiFetch } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/AuthProvider';
import { todayKST } from '../../lib/today/kst-date';
import { formatTodayTemperature } from '../../lib/scoring/temperature';

import { TodayAppBar } from '../../components/today/today-app-bar';
import { DateLine } from '../../components/today/date-line';
import { TodayHero } from '../../components/today/today-hero';
import { RelationChip } from '../../components/today/relation-chip';
import { AvoidActionCards } from '../../components/today/avoid-action-cards';
import { WhatifTrigger } from '../../components/today/whatif-trigger';
import { SwipeRow } from '../../components/layout/SwipeRow';
import { LoadingState } from '../../components/feedback/LoadingState';

import type { DailyHapCard } from '../../types/dailyHap';
import type { FeedListItem, RelationChipItem } from '../../types/relation';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const TOP_N_RELATIONS = 5;
const HOME_INTRO_POPUP_STORAGE_KEY = 'home_intro_popup_seen_date_v2';

// ---------------------------------------------------------------------------
// 로컬스토리지 헬퍼
// ---------------------------------------------------------------------------

function readHomeIntroSeenDate(): string | null {
  try {
    return window.localStorage.getItem(HOME_INTRO_POPUP_STORAGE_KEY);
  } catch {
    return todayKST();
  }
}

function markHomeIntroSeen(date: string): void {
  try {
    window.localStorage.setItem(HOME_INTRO_POPUP_STORAGE_KEY, date);
  } catch {
    // localStorage 차단 환경에서는 세션 내 닫힘 상태만 유지
  }
}

// ---------------------------------------------------------------------------
// API 응답 타입 (최소 shape)
// ---------------------------------------------------------------------------

interface ChartMinimal {
  day_pillar: string;
}

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
  // 쿼리 — GET /api/me/chart
  // -------------------------------------------------------------------------

  const chartQuery = useQuery({
    queryKey: ['me-chart'],
    queryFn: async (): Promise<ChartMinimal | null> => {
      try {
        const res = await apiFetch<{ ok: boolean; chart: ChartMinimal | null }>('/api/me/chart', { token });
        return res.chart ?? null;
      } catch {
        return null;
      }
    },
  });

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
  const [introOpen, setIntroOpen] = useState(false);

  // -------------------------------------------------------------------------
  // UNAUTHORIZED → /onboarding 리다이렉트
  // -------------------------------------------------------------------------

  const todayErrorMsg = (todayQuery.error as Error | null)?.message;

  useEffect(() => {
    if (todayQuery.isError && todayErrorMsg === 'UNAUTHORIZED') {
      navigate('/onboarding', { replace: true });
    }
  }, [todayQuery.isError, todayErrorMsg, navigate]);

  // -------------------------------------------------------------------------
  // 환영 팝업 — 하루 1회 (localStorage 기반)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (readHomeIntroSeenDate() !== todayDate) {
      setIntroOpen(true);
    }
  }, [todayDate]);

  function handleIntroClose() {
    markHomeIntroSeen(todayDate);
    setIntroOpen(false);
  }

  // -------------------------------------------------------------------------
  // 파생 값
  // -------------------------------------------------------------------------

  const showFallbackToday = todayQuery.isError && todayErrorMsg !== 'UNAUTHORIZED';
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

      {/* 환영 팝업 — 하루 1회 */}
      {introOpen && (
        <>
          <div
            onClick={handleIntroClose}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 51,
              background: 'var(--card)',
              borderRadius: 'var(--r-xl)',
              padding: 24,
              width: 'calc(100% - 2rem)',
              maxWidth: 420,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ font: 'var(--t-h2)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                {t('intro.question')}
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(var(--text-primary), 0.85)', margin: 0 }}>
                {t('intro.prefix')}
                <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('intro.emphasis')}</strong>
                {t('intro.suffix')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleIntroClose}
              style={{
                height: 48,
                width: '100%',
                borderRadius: 'var(--r-pill)',
                background: 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('intro.button')}
            </button>
          </div>
        </>
      )}

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
            {topRelations.map((r) => (
              <li key={r.relation_id}>
                <SwipeRow
                  onDelete={() => setConfirmDelete(r)}
                  onClick={() => {
                    if (chartQuery.isLoading) return;
                    if (!chart) {
                      navigate('/onboarding');
                      return;
                    }
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
                  }}>
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
            ))}
          </ul>
        </section>
      )}

      {/* 피할 말 + 좋은 행동 카드 */}
      {card && <AvoidActionCards card={card} />}

      {/* 또 다른 나 진입 버튼 (차트 있을 때만) */}
      {card && chart && <WhatifTrigger />}

      {/* 삭제 확인 다이얼로그 */}
      {confirmDelete && (
        <>
          <div
            onClick={() => setConfirmDelete(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 51,
              background: 'var(--card)',
              borderRadius: 20,
              padding: 20,
              width: 'calc(100% - 3rem)',
              maxWidth: 320,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ font: 'var(--t-h3)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {t('delete.confirmTitle', { nickname: confirmDelete.nickname })}
            </p>
            <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>
              {t('delete.confirmBody')}
            </p>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'var(--muted)', color: 'var(--text-primary)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                {t('delete.cancel')}
              </button>
              <button
                onClick={() => {
                  del.mutate(confirmDelete.relation_id);
                  setConfirmDelete(null);
                }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'var(--warn)', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                {t('delete.confirm')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
