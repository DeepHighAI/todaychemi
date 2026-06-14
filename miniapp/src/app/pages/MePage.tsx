/**
 * MePage.tsx — 본명식(내 사주맵) 페이지 (미니앱 포트)
 *
 * 웹앱 원본: src/app/(app)/me/page.tsx
 *
 * 변환 요약:
 *   - useRouter(next) → useNavigate(react-router-dom)
 *   - fetch → apiFetch + useAuth 토큰
 *   - ThemeToggle → 제거 (미니앱: 시스템 다크모드 자동, 토글 없음)
 *   - AboutDialog / LangSheet → 제거 (미니앱 채널 — 언어 KO 고정, 회사소개 외부링크)
 *   - Dialog (shadcn/ui 기반) → miniapp/src/components/ui/dialog (base-ui 포트)
 *   - next-intl useTranslations → 유지 (provider 마운트됨)
 *   - Tailwind → 인라인 스타일
 *   - signOut: POST /api/auth/sign-out → useAuth().logout()
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';

import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { EmptyState } from '@/components/feedback/EmptyState';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { MeHero } from '@/components/me/me-hero';
import { MeEditRow } from '@/components/me/me-edit-row';
import { MeEditDrawer } from '@/components/me/me-edit-drawer';
import { TalismanCard } from '@/components/me/talisman-card';
import { InfoCard } from '@/components/me/info-card';
import { PillarGrid } from '@/components/me/pillar-grid';
import { OhaengBars } from '@/components/hapcard/primitives/ohaeng-bars';
import { DayMasterCard } from '@/components/me/day-master-card';
import YunseCard from '@/components/me/yunse-card';

import type { ChartCore } from '@/types/chart';
import type { WalletResponse } from '@/types/wallet';

// ---------------------------------------------------------------------------
// 헬퍼 — 법적 문서 링크 (앱인토스 채널: 외부 링크는 앱 정책상 브라우저로 열어야 함)
// ---------------------------------------------------------------------------

/** 외부 링크를 네이티브 브라우저로 여는 헬퍼 */
function openExternal(url: string) {
  // 앱인토스 WebView: window.open 또는 location.href 모두 내부 WebView에서 열림.
  // 외부 브라우저가 필요하면 openExternalBrowser() SDK API 사용 (TODO P5).
  window.open(url, '_blank', 'noopener');
}

// ---------------------------------------------------------------------------
// MePage
// ---------------------------------------------------------------------------

export function MePage() {
  const t = useTranslations('me');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, logout } = useAuth();

  // chart 데이터 조회
  const { data: chart, isLoading, isError, refetch } = useQuery({
    queryKey: ['me-chart'],
    queryFn: () =>
      apiFetch<{ ok: boolean; chart: ChartCore | null }>('/api/me/chart', { token }).then(
        (r) => r.chart ?? null,
      ),
  });

  // 부적 지갑 조회 (chart 가 있을 때만)
  const { data: wallet } = useQuery({
    queryKey: ['me-wallet'],
    queryFn: () =>
      apiFetch<WalletResponse>('/api/me/wallet', { token }),
    enabled: Boolean(chart),
    refetchOnMount: 'always',
  });

  // 로컬 상태
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteRequestedAt, setDeleteRequestedAt] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // 계정 삭제 요청
  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const result = await apiFetch<{ deletion_requested_at: string }>(
        '/api/me/delete-request',
        { method: 'POST', token },
      );
      setDeleteRequestedAt(result.deletion_requested_at);
    } catch {
      setDeleteError(t('privacyControls.deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  }

  // 로그아웃 — useAuth logout() 으로 토큰 제거 후 /login 이동
  async function handleLogout() {
    setLogoutLoading(true);
    setLogoutError(null);
    try {
      // 서버 측 세션 해제 (실패해도 클라이언트는 정리함)
      await apiFetch('/api/auth/sign-out', { method: 'POST', token }).catch(() => {/* 무시 */});
      queryClient.clear();
      await logout();
      navigate('/onboarding');
    } catch {
      setLogoutError(t('info.logoutError'));
      setLogoutOpen(false);
      setLogoutLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // 상태별 렌더
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <ErrorCard code="NETWORK_OFFLINE" onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!chart) {
    return (
      <EmptyState
        title={t('empty.title')}
        body={t('empty.body')}
        cta={t('empty.cta')}
        onCta={() => navigate('/onboarding')}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // 메인 렌더
  // ---------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 16px' }}>
      {/* 히어로: 일주 칩 */}
      <MeHero chart={chart} />

      {/* 정보 수정 진입 */}
      <MeEditRow onClick={() => setEditOpen(true)} />
      <MeEditDrawer open={editOpen} onOpenChange={setEditOpen} />

      {/* 부적 지갑 (있을 때만) */}
      {wallet && <TalismanCard balance={wallet.balance} ledger={wallet.ledger} />}

      {/* 4기둥 그리드 */}
      <PillarGrid chart={chart} />

      {/* 오행 분포 바 */}
      <OhaengBars data={chart.five_elements_counts} />

      {/* 일간 설명 */}
      <DayMasterCard element={chart.day_master_element} />

      {/* 운세 흐름 (대운·세운·월운·일운) */}
      <YunseCard yunse={chart.yunse} />

      {/* 앱 정보 / 설정 */}
      <InfoCard
        onPrivacy={() => openExternal('https://todaychemi.vercel.app/legal/privacy')}
        onTerms={() => openExternal('https://todaychemi.vercel.app/legal/terms')}
        onAbout={() => openExternal('https://deephalabs.com')}
        onLang={() => {
          // 미니앱: 언어 KO 고정 — 추후 다국어 지원 시 시트로 교체 (TODO P5)
        }}
        onDeleteAccount={() => setDeleteOpen(true)}
        onLogout={() => {
          setLogoutError(null);
          setLogoutOpen(true);
        }}
        logoutLoading={logoutLoading}
      />

      {/* 로그아웃 에러 알림 */}
      {logoutError && (
        <p
          role="alert"
          style={{
            borderRadius: 'var(--r-sm)',
            backgroundColor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
            padding: '8px 12px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--destructive)',
            margin: 0,
          }}
        >
          {logoutError}
        </p>
      )}

      {/* 로그아웃 확인 다이얼로그 */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('info.logoutConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={logoutLoading}
              onClick={() => setLogoutOpen(false)}
            >
              {t('info.logoutConfirmNo')}
            </Button>
            <Button
              variant="destructive"
              disabled={logoutLoading}
              onClick={() => void handleLogout()}
            >
              {logoutLoading ? t('info.logoutLoading') : t('info.logoutConfirmYes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 계정 삭제 확인 다이얼로그 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('privacyControls.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('privacyControls.deleteBody')}</DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p
              role="alert"
              style={{
                borderRadius: 'var(--r-sm)',
                backgroundColor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--destructive)',
                margin: 0,
              }}
            >
              {deleteError}
            </p>
          )}
          {deleteRequestedAt && (
            <p
              style={{
                borderRadius: 'var(--r-sm)',
                backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--primary)',
                margin: 0,
              }}
            >
              {t('privacyControls.deleteSuccess')}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('privacyControls.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLoading || Boolean(deleteRequestedAt)}
              onClick={() => void handleDeleteAccount()}
            >
              {deleteLoading ? t('privacyControls.deleting') : t('privacyControls.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
