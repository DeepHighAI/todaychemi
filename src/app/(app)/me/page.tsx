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
import { ChargeSheet } from '@/components/dialogs/charge-sheet';
import { AboutDialog } from '@/components/dialogs/about-dialog';
import { LegalSheet } from '@/components/dialogs/legal-sheet';
import { LangSheet } from '@/components/dialogs/lang-sheet';
import { PillarGrid } from '@/components/me/pillar-grid';
import { OhaengBars } from '@/components/hapcard/primitives/ohaeng-bars';
import { DayMasterCard } from '@/components/me/day-master-card';
import YunseCard from '@/components/me/yunse-card';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { listTossProducts } from '@/lib/payments/products';
import type { ChartCore } from '@/types/chart';
import type { PaymentInitResponse, WalletProduct, WalletResponse } from '@/types/wallet';

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

async function initPayment(productId: WalletProduct['product_id']): Promise<PaymentInitResponse> {
  const res = await fetch('/api/payments/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product_id: productId }),
  });
  if (!res.ok) throw new Error('PAYMENT_INIT_FAILED');
  return (await res.json()) as PaymentInitResponse;
}

const PRODUCTS: WalletProduct[] = listTossProducts();

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
  const [chargeOpen, setChargeOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function handleConfirmPay(productId: WalletProduct['product_id']) {
    setPaying(true);
    setPaymentError(null);
    try {
      const result = await initPayment(productId);
      setChargeOpen(false);
      router.push(`/payment/checkout?orderId=${encodeURIComponent(result.payment.toss_order_id)}`);
    } catch {
      setPaymentError(t('wallet.error'));
    } finally {
      setPaying(false);
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
          onCharge={() => setChargeOpen(true)}
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
        onPrivacy={() => setPrivacyOpen(true)}
        onTerms={() => setTermsOpen(true)}
        onAbout={() => setAboutOpen(true)}
        onLang={() => setLangOpen(true)}
      />
      <ChargeSheet
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        currentBalance={wallet?.balance.balance ?? 0}
        products={PRODUCTS}
        error={paymentError}
        loading={paying}
        onConfirmPay={handleConfirmPay}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <LegalSheet variant="privacy" open={privacyOpen} onOpenChange={setPrivacyOpen} />
      <LegalSheet variant="terms" open={termsOpen} onOpenChange={setTermsOpen} />
      <LangSheet open={langOpen} onOpenChange={setLangOpen} />
    </div>
  );
}
