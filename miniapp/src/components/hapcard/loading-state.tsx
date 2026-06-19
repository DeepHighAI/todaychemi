/**
 * loading-state.tsx — 케미카드 로딩 상태 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/loading-state.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거, next-intl useTranslations 유지.
 */

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const LOADING_PHASES = [
  { key: 'structure', startsAtMs: 0 },
  { key: 'balance', startsAtMs: 10_000 },
  { key: 'writing', startsAtMs: 25_000 },
  { key: 'longWait', startsAtMs: 45_000 },
] as const;

type LoadingPhaseKey = (typeof LOADING_PHASES)[number]['key'];

export function HapcardLoadingState() {
  const t = useTranslations('hapcard.loadingView');
  const [phaseKey, setPhaseKey] = useState<LoadingPhaseKey>('structure');
  const isLongWait = phaseKey === 'longWait';

  useEffect(() => {
    const timers = LOADING_PHASES.slice(1).map((phase) =>
      window.setTimeout(() => setPhaseKey(phase.key), phase.startsAtMs),
    );
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <section
      aria-busy="true"
      aria-labelledby="hapcard-loading-title"
      data-testid="hapcard-loading-state"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 520, margin: '0 auto', paddingBottom: 48 }}
    >
      <div style={{ borderRadius: 'var(--r-xl)', border: '1px solid var(--hairline)', backgroundColor: 'var(--bg-card)', padding: '24px 20px', textAlign: 'center' }}>
        <div style={{
          margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 48, height: 48, borderRadius: '50%',
          backgroundColor: 'var(--p-95)', color: 'var(--primary)',
        }}>
          <LoaderCircle style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} aria-hidden />
        </div>
        <h1 id="hapcard-loading-title" style={{ font: 'var(--t-h1)', color: 'var(--text-primary)', margin: '0 0 8px', wordBreak: 'keep-all' }}>
          {t('title')}
        </h1>
        <p data-testid="hapcard-loading-estimate" style={{ font: 'var(--t-sub)', color: 'var(--muted-foreground)', margin: 0, wordBreak: 'keep-all' }}>
          {t('estimate')}
        </p>
        {/* 항목 8: 결제 후 백그라운드 분석 보장 안내 — 앱을 나가도 서버가 끝까지 생성 */}
        <p data-testid="hapcard-loading-background" style={{ font: 'var(--t-cap)', color: 'var(--primary)', margin: '8px 0 0', wordBreak: 'keep-all' }}>
          {t('background')}
        </p>
      </div>

      <div
        role="status"
        aria-live="polite"
        data-testid="hapcard-loading-status"
        style={{ borderRadius: 'var(--r-xl)', border: '1px solid var(--hairline)', backgroundColor: 'var(--bg-card)', padding: 16 }}
      >
        <p style={{ font: 'var(--t-cap)', color: 'var(--primary)', margin: '0 0 8px' }}>{t('statusLabel')}</p>
        <p style={{ font: 'var(--t-h2)', color: 'var(--text-primary)', margin: '0 0 8px', wordBreak: 'keep-all' }}>
          {t(`phases.${phaseKey}.title`)}
        </p>
        <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0, wordBreak: 'keep-all' }}>
          {t(`phases.${phaseKey}.body`)}
        </p>
      </div>

      <div style={{ borderRadius: 'var(--r-xl)', backgroundColor: 'var(--surface-1)', padding: 16 }}>
        <p style={{ font: 'var(--t-cap)', color: 'var(--on-surface-var)', margin: '0 0 8px' }}>{t('readLabel')}</p>
        <p data-testid="hapcard-loading-note" style={{ font: 'var(--t-body)', color: 'var(--text-primary)', margin: 0, wordBreak: 'keep-all' }}>
          {t(`phases.${phaseKey}.note`)}
        </p>
      </div>

      {isLongWait && (
        <div data-testid="hapcard-loading-long-wait" style={{ borderRadius: 'var(--r-xl)', backgroundColor: 'var(--info-bg)', padding: 16 }}>
          <p style={{ font: 'var(--t-h3)', color: 'var(--info)', margin: '0 0 4px', wordBreak: 'keep-all' }}>{t('longWait.title')}</p>
          <p style={{ font: 'var(--t-sub)', color: 'var(--info)', margin: 0, wordBreak: 'keep-all' }}>{t('longWait.body')}</p>
        </div>
      )}

      <div data-testid="hapcard-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-hidden>
        <div style={{ height: 40, borderRadius: 'var(--r-md)', backgroundColor: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 160, borderRadius: 'var(--r-xl)', backgroundColor: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 96, borderRadius: 'var(--r-xl)', backgroundColor: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </section>
  );
}
