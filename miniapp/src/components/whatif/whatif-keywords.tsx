/**
 * whatif-keywords.tsx — 키워드 뱃지 섹션 (미니앱 포트)
 *
 * 웹앱 원본: src/components/whatif/whatif-keywords.tsx (next-intl + Tailwind)
 * 변경: 'use client' 제거, Tailwind → 인라인 스타일.
 */

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';

interface WhatifKeywordsProps {
  keywords: readonly string[];
}

export function WhatifKeywords({ keywords }: WhatifKeywordsProps) {
  const t = useTranslations('whatif.result');
  return (
    <div
      data-testid="whatif-keywords"
      className="card-elevated"
      style={{
        borderRadius: 'var(--r-lg)',
        backgroundColor: 'var(--bg-card)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <p style={{ font: 'var(--t-sub)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        {t('section.keywords')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {keywords.map((keyword, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 'var(--r-pill)',
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: 'var(--primary-muted, color-mix(in srgb, var(--primary) 10%, transparent))',
              color: 'var(--primary)',
            }}
          >
            {convertHanja(keyword)}
          </span>
        ))}
      </div>
    </div>
  );
}
