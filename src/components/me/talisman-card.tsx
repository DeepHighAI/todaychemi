'use client';

import { useState } from 'react';
import { ChevronRight, Plus, Receipt, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { LedgerEntry, WalletBalance } from '@/types/wallet';

interface TalismanCardProps {
  balance: WalletBalance;
  ledger: LedgerEntry[];
  onCharge: () => void;
}

const REASON_LABEL: Record<string, string> = {
  purchase: '충전',
  hapcard_use: '오늘 우리는',
  hapcard_refund: '오늘 우리는 환불',
  replay_use: '그럴리 없어! 다시',
  replay_refund: '재해석 환불',
  whatif_use: '또 다른 나',
  whatif_refund: '또 다른 나 환불',
  refund: '환불',
  bonus: '보너스',
};

export function TalismanCard({ balance, ledger, onCharge }: TalismanCardProps) {
  const t = useTranslations('me.wallet');
  const [expanded, setExpanded] = useState(false);
  const recent = ledger.slice(0, 4);
  const maxBucket = Math.max(1, ...balance.monthly_buckets);

  return (
    <section
      data-testid="talisman-card"
      className="overflow-hidden rounded-[var(--r-md)] border border-[var(--hairline)] bg-[linear-gradient(135deg,#fff7e8_0%,#f2e7ff_52%,#fff1e8_100%)] shadow-[var(--e-1)]"
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-[18px] bg-[var(--p-40)] text-white shadow-[var(--e-2)]">
            <Sparkles size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--p-40)]">
              {t('eyebrow')}
            </p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold leading-none text-foreground">
                {balance.balance.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-muted-foreground">{t('unit')}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {t('validUntil', { date: balance.next_expiry_at ? formatDate(balance.next_expiry_at) : '미정' })}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{t('monthlyUsed')}</span>
            <span className="text-xs font-bold text-foreground">-{balance.monthly_used} {t('unit')}</span>
          </div>
          <div className="flex h-[22px] items-end gap-[3px]">
            {balance.monthly_buckets.map((bucket, index) => (
              <span
                key={index}
                className="flex-1 rounded-[3px] bg-[var(--p-40)]/25"
                style={{ height: `${Math.max(3, Math.round((bucket / maxBucket) * 22))}px` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCharge}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--r-pill)] bg-primary text-sm font-bold text-primary-foreground active:translate-y-px"
          >
            <Plus size={18} />
            {t('charge')}
          </button>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--r-pill)] border border-border bg-card text-sm font-bold text-foreground active:translate-y-px"
          >
            <Receipt size={17} />
            {t('history')}
            <ChevronRight
              size={15}
              className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--hairline)] bg-card px-4 py-2">
          {recent.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">{t('emptyHistory')}</p>
          ) : (
            recent.map((row) => <LedgerRow key={row.ledger_id} row={row} />)
          )}
        </div>
      )}
    </section>
  );
}

function LedgerRow({ row }: { row: LedgerEntry }) {
  const positive = row.delta > 0;
  return (
    <div className="flex items-center justify-between border-b border-[var(--hairline)] py-3 last:border-b-0">
      <div>
        <p className="text-sm font-bold text-foreground">{REASON_LABEL[row.reason] ?? row.reason}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
      </div>
      <div className="text-right">
        <p className={positive ? 'text-sm font-extrabold text-[var(--ok,#386a20)]' : 'text-sm font-extrabold text-foreground'}>
          {positive ? '+' : ''}{row.delta} 부적
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">잔액 {row.balance_after}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
