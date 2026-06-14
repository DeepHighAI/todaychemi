/**
 * cause-factors.tsx — 명리 근거(cause_factors) 표시 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/cause-factors.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거.
 * ADR-015: 명리 근거 항상 표시. ADR-038: convertHanja() 안전망 필수.
 */

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';

interface CauseFactor {
  name: string;
  effect: string;
}

interface HapcardCauseFactorsProps {
  factors: CauseFactor[];
}

export function HapcardCauseFactors({ factors }: HapcardCauseFactorsProps) {
  const t = useTranslations('hapcard');

  return (
    <div data-testid="hapcard-cause-factors" style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ font: 'var(--t-cap)', color: 'var(--primary)', margin: 0 }}>{t('causeFactors.title')}</p>
      {factors.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{t('causeFactors.empty')}</p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, listStyle: 'none' }}>
          {factors.map((factor, index) => (
            <li key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span
                aria-hidden
                style={{
                  display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%',
                  backgroundColor: 'var(--surface-2)',
                  fontSize: 11, fontWeight: 800, color: 'var(--primary)',
                }}
              >
                {index + 1}
              </span>
              <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* ADR-038: convertHanja() 안전망 */}
                <span style={{ font: 'var(--t-body)', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{convertHanja(factor.name)}</span>
                <span style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', display: 'block' }}>{convertHanja(factor.effect)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
