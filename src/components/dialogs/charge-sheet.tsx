'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Drawer } from 'vaul';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { WalletProduct } from '@/types/wallet';

interface ChargeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  products: WalletProduct[];
  onConfirmPay: (productId: WalletProduct['product_id']) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export function ChargeSheet({
  open,
  onOpenChange,
  currentBalance,
  products,
  onConfirmPay,
  loading = false,
  error = null,
}: ChargeSheetProps) {
  const t = useTranslations('wallet.charge');
  const [selectedId, setSelectedId] = useState<WalletProduct['product_id']>('tokens_50');
  const selected = products.find((product) => product.product_id === selectedId) ?? products[0];

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] bg-background"
        >
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[var(--surface-2)]" />
          <div className="relative overflow-hidden px-5 pb-5 pt-4">
            <div className="absolute inset-0 bg-liquid-hero opacity-90" />
            <div className="relative flex items-center justify-between text-white">
              <Drawer.Title className="text-lg font-extrabold">{t('title')}</Drawer.Title>
              <Drawer.Close asChild>
                <button type="button" aria-label="닫기" className="flex size-9 items-center justify-center rounded-full bg-white/15">
                  <X size={20} />
                </button>
              </Drawer.Close>
            </div>
            <div className="relative mt-4 flex items-center gap-3 text-white">
              <div className="flex size-14 items-center justify-center rounded-[18px] bg-white/20">
                <Sparkles size={28} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.04em] text-white/80">{t('currentBalance')}</p>
                <p className="mt-1 text-3xl font-extrabold leading-none">
                  {currentBalance.toLocaleString()}
                  <span className="ml-1 text-sm font-bold text-white/80">부적</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto px-5 pb-6 pt-5">
            {products.map((product) => (
              <button
                key={product.product_id}
                type="button"
                aria-pressed={selectedId === product.product_id}
                onClick={() => setSelectedId(product.product_id)}
                className={`flex w-full items-center gap-3 rounded-[var(--r-md)] border p-4 text-left transition ${
                  selectedId === product.product_id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <span className="flex size-11 items-center justify-center rounded-[14px] bg-[var(--surface-2)] text-primary">
                  <Sparkles size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold text-foreground">
                    {product.tokens.toLocaleString()}부적
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                    {product.label}
                  </span>
                </span>
                <span className="text-base font-extrabold text-foreground">
                  ₩{product.amount_krw.toLocaleString()}
                </span>
              </button>
            ))}

            <p className="text-center text-xs leading-5 text-muted-foreground">
              {t('tossNotice')}
            </p>
            {error && (
              <p role="alert" className="rounded-[var(--r-sm)] bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="button"
              className="h-12 w-full"
              disabled={loading || !selected}
              onClick={() => selected && onConfirmPay(selected.product_id)}
            >
              {loading || !selected
                ? t('loading')
                : t('payCta', { amount: selected.amount_krw.toLocaleString() })}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
