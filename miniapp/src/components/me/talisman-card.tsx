/**
 * talisman-card.tsx — 부적 잔액 + 사용 내역 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/talisman-card.tsx
 * 미니앱: Tailwind → 인라인 스타일. lucide-react 유지(package.json 설치됨).
 * "충전" 버튼은 ADR-039 pay-per-use 전환으로 이미 제거됨(web app D `57a443d`).
 */

import { useState } from 'react';
import { ChevronRight, Receipt, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LedgerEntry, WalletBalance } from '@/types/wallet';

interface TalismanCardProps {
  balance: WalletBalance;
  ledger: LedgerEntry[];
}

// 거래 사유 한글 레이블
const REASON_LABEL: Record<string, string> = {
  purchase: '충전',
  hapcard_use: '케미카드',
  hapcard_refund: '케미카드 환불',
  replay_use: '케미 다시 맞추기',
  replay_refund: '케미 다시 맞추기 환불',
  whatif_use: '오늘의 나는?',
  whatif_refund: '오늘의 나는? 환불',
  relation_slot_use: '인연 등록',
  relation_slot_refund: '인연 등록 환불',
  refund: '환불',
  bonus: '보너스',
};

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function TalismanCard({ balance, ledger }: TalismanCardProps) {
  const t = useTranslations('me.wallet');
  const [expanded, setExpanded] = useState(false);
  const recent = ledger.slice(0, 4);
  const maxBucket = Math.max(1, ...balance.monthly_buckets);

  return (
    <section
      data-testid="talisman-card"
      style={{
        overflow: 'hidden',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--hairline)',
        background: 'linear-gradient(135deg,#fff7e8 0%,#f2e7ff 52%,#fff1e8 100%)',
        boxShadow: 'var(--e-1)',
      }}
    >
      <div style={{ padding: 16 }}>
        {/* 잔액 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              width: 56,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 18,
              backgroundColor: 'var(--p-40)',
              color: '#fff',
              boxShadow: 'var(--e-2)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={26} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--p-40)',
                margin: 0,
              }}
            >
              {t('eyebrow')}
            </p>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)' }}>
                {balance.balance.toLocaleString()}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {t('unit')}
              </span>
            </div>
            <p style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              {t('validUntil', { date: balance.next_expiry_at ? formatDate(balance.next_expiry_at) : '미정' })}
            </p>
          </div>
        </div>

        {/* 월별 사용 바 */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t('monthlyUsed')}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              -{balance.monthly_used} {t('unit')}
            </span>
          </div>
          <div style={{ display: 'flex', height: 22, alignItems: 'flex-end', gap: 3 }}>
            {balance.monthly_buckets.map((bucket, index) => (
              <span
                key={index}
                style={{
                  flex: 1,
                  borderRadius: 3,
                  backgroundColor: 'color-mix(in srgb, var(--p-40) 25%, transparent)',
                  height: `${Math.max(3, Math.round((bucket / maxBucket) * 22))}px`,
                }}
              />
            ))}
          </div>
        </div>

        {/* 내역 토글 버튼 */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            style={{
              display: 'flex',
              flex: 1,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--hairline)',
              backgroundColor: 'var(--bg-card)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <Receipt size={17} />
            {t('history')}
            <ChevronRight
              size={15}
              style={{
                transform: expanded ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </button>
        </div>
      </div>

      {/* 내역 목록 */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--hairline)',
            backgroundColor: 'var(--bg-card)',
            padding: '0 16px',
          }}
        >
          {recent.length === 0 ? (
            <p
              style={{
                padding: '20px 0',
                textAlign: 'center',
                fontSize: 14,
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              {t('emptyHistory')}
            </p>
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--hairline)',
        padding: '12px 0',
      }}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {REASON_LABEL[row.reason] ?? row.reason}
        </p>
        <p style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
          {formatDate(row.created_at)}
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: positive ? 'var(--ok, #386a20)' : 'var(--text-primary)',
            margin: 0,
          }}
        >
          {positive ? '+' : ''}{row.delta} 부적
        </p>
        <p style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
          잔액 {row.balance_after}
        </p>
      </div>
    </div>
  );
}
