/**
 * change-indicator.tsx — 케미카드 변화 폭 인디케이터 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/change-indicator.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거, fetch → apiFetch 경로.
 * ADR-036: scoring_version / prompt_version 동일 시만 comparable.
 * §1.1 2026-06-13 확정: 비교 불가 상태도 항상 표시 영역 유지.
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { formatTemperatureDelta } from '@/lib/scoring/temperature';
import type { HapcardChangeResponse } from '@/types/hapcard';

interface Props {
  hapcardId: string;
  /** Bearer 토큰 (인증 필요 경로) */
  token?: string | null;
}

async function fetchChange(hapcardId: string, token?: string | null): Promise<HapcardChangeResponse> {
  return apiFetch<HapcardChangeResponse>(`/api/hapcards/${hapcardId}/change`, { token });
}

// 부호 있는 원점수 표기 (요인 변화량)
function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function HapcardChangeIndicator({ hapcardId, token }: Props) {
  const t = useTranslations('hapcard.changeIndicator');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hapcard-change', hapcardId],
    queryFn: () => fetchChange(hapcardId, token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        data-testid="hapcard-change-skeleton"
        role="status"
        aria-label={t('loading')}
        style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ height: 12, width: 112, borderRadius: 4, backgroundColor: 'var(--surface-2)' }} />
        <div style={{ height: 20, width: 80, borderRadius: 4, backgroundColor: 'var(--surface-2)' }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        data-testid="hapcard-change"
        role="alert"
        style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 16, fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}
      >
        {t('error')}
      </div>
    );
  }

  // 비교 불가(first / version_changed) → 안내 문구만 (변화 자리는 항상 유지, §1.1)
  if (data.status !== 'comparable') {
    const message = data.status === 'first' ? t('first') : t('versionChanged');
    return (
      <div data-testid="hapcard-change" style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0 }}>{t('title')}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{message}</p>
      </div>
    );
  }

  const delta = data.delta ?? 0;
  const direction = delta > 0 ? t('up') : delta < 0 ? t('down') : t('same');
  const deltaColor = delta > 0 ? 'var(--ok)' : delta < 0 ? 'var(--warn)' : 'var(--text-secondary)';

  return (
    <div data-testid="hapcard-change" style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0 }}>{t('title')}</p>

      <div data-testid="hapcard-change-delta" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: deltaColor, fontVariantNumeric: 'tabular-nums' }}>
          {formatTemperatureDelta(delta)}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: deltaColor }}>{direction}</span>
      </div>

      {data.factors.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
          {data.factors.map((entry) => {
            const factorColor = entry.delta > 0 ? 'var(--ok)' : 'var(--warn)';
            return (
              <li
                key={entry.factor}
                data-testid="hapcard-change-factor"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{t(`factor.${entry.factor}`)}</span>
                <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: factorColor }}>
                  {signed(entry.delta)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
