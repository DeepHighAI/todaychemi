/**
 * whatif-hero.tsx — 또 다른 나 히어로 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/whatif/whatif-hero.tsx (next-intl + Tailwind)
 * 변경: 'use client' 제거, Tailwind → 인라인 스타일.
 * AiDisclosureBadge 유지 (AI 생성 고지 의무, ADR-038/1G).
 */

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';
import { AiDisclosureBadge } from '@/components/ai-disclosure/ai-disclosure-badge';
import type { DiagnosticType } from '@/types/diagnostic';

interface WhatifHeroProps {
  type: DiagnosticType;
  body: string;
}

export function WhatifHero({ type, body }: WhatifHeroProps) {
  const t = useTranslations('whatif.card');
  return (
    <div
      data-testid="whatif-hero"
      style={{
        borderRadius: 'var(--r-lg)',
        backgroundColor: 'var(--bg-card)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p
          style={{
            font: 'var(--t-cap)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-wide)',
            margin: 0,
          }}
        >
          {t(`${type}.title`)}
        </p>
        <AiDisclosureBadge tone="light" />
      </div>
      <p
        style={{
          font: 'var(--t-body)',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-line',
          margin: 0,
        }}
      >
        {convertHanja(body)}
      </p>
    </div>
  );
}
