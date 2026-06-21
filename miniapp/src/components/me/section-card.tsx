/**
 * section-card.tsx — 내 프로필(본명식) 콘텐츠 카드 통일 템플릿
 *
 * 본명식 화면의 콘텐츠 카드(4기둥·오행·일간 등)가 서로 다른 surface 처리를
 * 쓰던 것을 하나의 카드 언어로 통일한다(talisman 지갑 카드는 그라데이션 특수
 * 카드로 별도 유지). surface = bg-card + r-lg + 1px hairline + e-1 elevation.
 * eyebrow 는 --t-eyebrow + --ls-wide 토큰으로 일관된 섹션 라벨을 제공한다.
 */

import type { CSSProperties, ReactNode } from 'react';

interface SectionCardProps {
  eyebrow?: string;
  children: ReactNode;
  /** 카드 내부 콘텐츠 간격(기본 12) — 조밀한 카드는 8 로 낮춘다. */
  gap?: number;
  style?: CSSProperties;
  'data-testid'?: string;
}

export function SectionCard({ eyebrow, children, gap = 12, style, ...rest }: SectionCardProps) {
  return (
    <section
      {...rest}
      style={{
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--hairline)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--e-1)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap,
        ...style,
      }}
    >
      {eyebrow && (
        <p
          style={{
            font: 'var(--t-eyebrow)',
            letterSpacing: 'var(--ls-wide)',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          {eyebrow}
        </p>
      )}
      {children}
    </section>
  );
}
