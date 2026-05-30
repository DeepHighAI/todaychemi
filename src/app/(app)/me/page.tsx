'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { MeHero } from '@/components/me/me-hero';
import { MeEditRow } from '@/components/me/me-edit-row';
import { MeEditDrawer } from '@/components/me/me-edit-drawer';
import { TalismanCard } from '@/components/me/talisman-card';
import { InfoCard } from '@/components/me/info-card';
import { AboutDialog } from '@/components/dialogs/about-dialog';
import { LangSheet } from '@/components/dialogs/lang-sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PillarGrid } from '@/components/me/pillar-grid';
import { OhaengBars } from '@/components/hapcard/primitives/ohaeng-bars';
import { DayMasterCard } from '@/components/me/day-master-card';
import YunseCard from '@/components/me/yunse-card';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import type { ChartCore } from '@/types/chart';
import type { WalletResponse } from '@/types/wallet';

async function fetchMyChart(): Promise<ChartCore | null> {
  const res = await fetch('/api/me/chart');
  if (!res.ok) throw new Error('ME_CHART_FETCH_FAILED');
  const body = (await res.json()) as { ok: boolean; chart: ChartCore | null };
  return body.chart ?? null;
}

async function fetchWallet(): Promise<WalletResponse> {
  const res = await fetch('/api/me/wallet');
  if (!res.ok) throw new Error('ME_WALLET_FETCH_FAILED');
  return (await res.json()) as WalletResponse;
}

async function requestAccountDeletion(): Promise<{ deletion_requested_at: string }> {
  const res = await fetch('/api/me/delete-request', { method: 'POST' });
  if (!res.ok) throw new Error('ACCOUNT_DELETE_REQUEST_FAILED');
  return (await res.json()) as { deletion_requested_at: string };
}

export default function MePage() {
  const t = useTranslations('me');
  const router = useRouter();
  const { data: chart, isLoading, isError, refetch } = useQuery({
    queryKey: ['me-chart'],
    queryFn: fetchMyChart,
  });
  const { data: wallet } = useQuery({
    queryKey: ['me-wallet'],
    queryFn: fetchWallet,
    enabled: Boolean(chart),
    refetchOnMount: 'always',
  });
  const [editOpen, setEditOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteRequestedAt, setDeleteRequestedAt] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const result = await requestAccountDeletion();
      setDeleteRequestedAt(result.deletion_requested_at);
    } catch {
      setDeleteError(t('privacyControls.deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-6">
        <ErrorCard code="NETWORK_OFFLINE" onRetry={() => refetch()} />
      </div>
    );
  }

  if (!chart) {
    return (
      <EmptyState
        title={t('empty.title')}
        body={t('empty.body')}
        cta={t('empty.cta')}
        onCta={() => router.push('/onboarding')}
      />
    );
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <MeHero chart={chart} />
      <MeEditRow onClick={() => setEditOpen(true)} />
      <MeEditDrawer open={editOpen} onOpenChange={setEditOpen} />
      {wallet && (
        <TalismanCard
          balance={wallet.balance}
          ledger={wallet.ledger}
          onCharge={() => router.push('/payments/charge')}
        />
      )}
      <PillarGrid chart={chart} />
      <OhaengBars data={chart.five_elements_counts} />
      <DayMasterCard element={chart.day_master_element} />
      <YunseCard yunse={chart.yunse} />
      <section className="rounded-[var(--r-md)] bg-card p-4 space-y-3">
        <p className="font-h3 text-foreground">{t('settings.appearance')}</p>
        <ThemeToggle />
      </section>
      <InfoCard
        onPrivacy={() => router.push('/legal/privacy')}
        onTerms={() => router.push('/legal/terms')}
        onAbout={() => setAboutOpen(true)}
        onLang={() => setLangOpen(true)}
        onDeleteAccount={() => setDeleteOpen(true)}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <LangSheet open={langOpen} onOpenChange={setLangOpen} />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('privacyControls.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('privacyControls.deleteBody')}</DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="rounded-[var(--r-sm)] bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {deleteError}
            </p>
          )}
          {deleteRequestedAt && (
            <p className="rounded-[var(--r-sm)] bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              {t('privacyControls.deleteSuccess')}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              className="rounded-[var(--r-sm)] px-4 py-2 text-sm font-bold text-muted-foreground"
              onClick={() => setDeleteOpen(false)}
            >
              {t('privacyControls.cancel')}
            </button>
            <button
              type="button"
              className="rounded-[var(--r-sm)] bg-destructive px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              disabled={deleteLoading || Boolean(deleteRequestedAt)}
              onClick={handleDeleteAccount}
            >
              {deleteLoading ? t('privacyControls.deleting') : t('privacyControls.confirmDelete')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
