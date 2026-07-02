/**
 * MePage.tsx — 본명식(내 사주맵) 페이지 (미니앱 포트)
 *
 * 웹앱 원본: src/app/(app)/me/page.tsx
 *
 * 변환 요약:
 *   - useRouter(next) → useNavigate(react-router-dom)
 *   - fetch → apiFetch + useAuth 토큰
 *   - ThemeToggle → 제거 (미니앱: 시스템 다크모드 자동, 토글 없음)
 *   - AboutDialog / 회사소개 외부링크 → 제거 (앱인토스 외부링크 정책: 자사 웹사이트·홍보 랜딩 제한)
 *   - LangSheet → 제거 (미니앱 채널 — 언어 KO 고정)
 *   - Dialog (shadcn/ui 기반) → miniapp/src/components/ui/dialog (base-ui 포트)
 *   - next-intl useTranslations → 유지 (provider 마운트됨)
 *   - Tailwind → 인라인 스타일
 *   - 로그아웃: 제거 (미니앱은 토스 자동 로그인이라 수동 로그아웃 불필요)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useMeChart } from '@/lib/me/use-me-chart';
import { useMeProfile } from '@/lib/me/use-me-profile';

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
import { MeEditDrawer } from '@/components/me/me-edit-drawer';
import { TalismanCard } from '@/components/me/talisman-card';
import { InfoCard } from '@/components/me/info-card';
import { FontSizeSheet } from '@/components/me/font-size-sheet';
import { PillarGrid } from '@/components/me/pillar-grid';
import { OhaengRadar } from '@/components/me/ohaeng-radar';
import { DayMasterCard } from '@/components/me/day-master-card';
import YunseCard from '@/components/me/yunse-card';

import type { WalletResponse } from '@/types/wallet';

type AccountIdResponse = {
  ok: boolean;
  userId: string;
};

// ---------------------------------------------------------------------------
// MePage
// ---------------------------------------------------------------------------

export function MePage() {
  const t = useTranslations('me');
  const tBirth = useTranslations('onboarding.birth');
  const navigate = useNavigate();
  const { token } = useAuth();

  // chart 데이터 조회 — ProfileGate·HomePage 와 ['me-chart'] 캐시 공유.
  const { data: chart, isLoading, isError, refetch } = useMeChart(token);

  // 프로필(닉네임·생일) 조회 — 히어로 표시용. MeEditDrawer 와 ['me-profile'] 캐시 공유.
  const { data: profile } = useMeProfile(token);

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
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteRequestedAt, setDeleteRequestedAt] = useState<string | null>(null);
  const [accountCopyMessage, setAccountCopyMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

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

  async function handleCopyAccountId() {
    setAccountCopyMessage(null);
    try {
      const result = await apiFetch<AccountIdResponse>('/api/me/account-id', { token });
      await copyTextToClipboard(result.userId);
      setAccountCopyMessage({ tone: 'success', text: t('info.accountIdCopied') });
    } catch {
      setAccountCopyMessage({ tone: 'error', text: t('info.accountIdCopyError') });
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

  // 생일 라벨: "1992.07.14 양력" (profile 로딩 전엔 undefined → 히어로가 서브타이틀 생략)
  const birthDateLabel = profile
    ? `${profile.birth_date.replaceAll('-', '.')} ${
        profile.birth_date_calendar === 'lunar' ? tBirth('calendarLunar') : tBirth('calendarSolar')
      }`
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 16px' }}>
      {/* 히어로: Dawn 워터컬러 + 떠있는 일주 카드 (편집 진입 버튼 내장) */}
      <MeHero
        chart={chart}
        nickname={profile?.nickname}
        birthDateLabel={birthDateLabel}
        onEdit={() => setEditOpen(true)}
      />
      <MeEditDrawer open={editOpen} onOpenChange={setEditOpen} />

      {/* 부적 지갑 (있을 때만) */}
      {wallet && <TalismanCard balance={wallet.balance} ledger={wallet.ledger} />}

      {/* 4기둥 그리드 */}
      <PillarGrid chart={chart} />

      {/* 오행 5축 레이더 + 가장 강한/약한 기운 칩 */}
      <OhaengRadar data={chart.five_elements_counts} />

      {/* 일간 설명 */}
      <DayMasterCard element={chart.day_master_element} />

      {/* 운세 흐름 (대운·세운·월운·일운) */}
      <YunseCard yunse={chart.yunse} />

      {/* 앱 정보 / 설정 */}
      <InfoCard
        onPrivacy={() => navigate('/legal/privacy')}
        onTerms={() => navigate('/legal/terms')}
        onRefund={() => navigate('/legal/refund')}
        onLang={() => {
          // 미니앱: 언어 KO 고정 — 추후 다국어 지원 시 시트로 교체 (TODO P5)
        }}
        onFontSize={() => setFontSheetOpen(true)}
        onCopyAccountId={() => void handleCopyAccountId()}
        onDeleteAccount={() => setDeleteOpen(true)}
      />
      {accountCopyMessage && (
        <p
          className={`account-copy-message account-copy-message--${accountCopyMessage.tone}`}
          role={accountCopyMessage.tone === 'error' ? 'alert' : 'status'}
        >
          {accountCopyMessage.text}
        </p>
      )}

      {/* 글자 크기 선택 바텀시트 */}
      <FontSizeSheet open={fontSheetOpen} onOpenChange={setFontSheetOpen} />

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

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('COPY_FAILED');
}
