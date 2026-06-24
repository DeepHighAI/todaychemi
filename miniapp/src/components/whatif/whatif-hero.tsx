/**
 * whatif-hero.tsx — 오늘의 나는? 히어로 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/whatif/whatif-hero.tsx (next-intl + Tailwind)
 * 변경: 'use client' 제거, Tailwind → 인라인 스타일. .liquid cool 리퀴드글래스(회색 카드 대체).
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
      className="liquid cool"
      style={{
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
            color: 'rgba(255,255,255,0.85)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-wide)',
            margin: 0,
          }}
        >
          {t(`${type}.title`)}
        </p>
        <AiDisclosureBadge tone="dark" />
      </div>
      <p
        style={{
          font: 'var(--t-body)',
          color: '#fff',
          whiteSpace: 'pre-line',
          margin: 0,
        }}
      >
        {convertHanja(body)}
      </p>
    </div>
  );
}
