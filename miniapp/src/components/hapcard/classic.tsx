/**
 * classic.tsx — 고전 인용 목록 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/classic.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거.
 * ADR-015: 명리 고전 근거 표시.
 */

import { useTranslations } from 'next-intl';

interface Citation {
  source: string;
  original: string;
  modern: string;
}

interface HapcardClassicProps {
  citations: Citation[];
}

export function HapcardClassic({ citations }: HapcardClassicProps) {
  const t = useTranslations('hapcard');

  return (
    <div data-testid="hapcard-classic" style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ font: 'var(--t-cap)', color: 'var(--primary)', margin: 0 }}>{t('classicList.title')}</p>
      {citations.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{t('classicList.empty')}</p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: 0, padding: 0, listStyle: 'none' }}>
          {citations.map((c, i) => (
            <li key={i} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ font: 'var(--t-cap)', color: 'var(--primary)', margin: 0 }}>{c.source}</p>
              <p style={{ font: 'var(--t-body)', color: 'var(--text-primary)', margin: 0 }}>{c.original}</p>
              <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>{c.modern}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
