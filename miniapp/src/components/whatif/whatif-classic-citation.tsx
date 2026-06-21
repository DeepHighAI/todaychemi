/**
 * whatif-classic-citation.tsx — 고전 인용 섹션 (미니앱 포트)
 *
 * 웹앱 원본: src/components/whatif/whatif-classic-citation.tsx (next-intl + Tailwind)
 * 변경: 'use client' 제거, Tailwind → 인라인 스타일.
 * ADR-038: convertHanja() 안전망 유지.
 */

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';
import type { ClassicCitation } from '@/types/diagnostic';

interface WhatifClassicCitationProps {
  citations?: ClassicCitation[];
}

export function WhatifClassicCitation({ citations }: WhatifClassicCitationProps) {
  const t = useTranslations('whatif.result');
  if (!citations || citations.length === 0) return null;
  return (
    <div
      data-testid="whatif-classic-citation"
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
        {t('section.classic_citation')}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {citations.map((c, i) => (
          <li
            key={i}
            style={{
              border: '1px solid var(--outline)',
              borderRadius: 'var(--r-md)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <p style={{ font: 'var(--t-cap)', fontWeight: 500, color: 'var(--primary)', margin: 0 }}>
              {convertHanja(c.source_title)}
            </p>
            <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0 }}>
              {convertHanja(c.source_chapter)}
            </p>
            <p style={{ font: 'var(--t-sub)', color: 'var(--text-primary)', fontStyle: 'italic', margin: 0 }}>
              {c.original_text}
            </p>
            <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0 }}>
              {convertHanja(c.modern_translation)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
