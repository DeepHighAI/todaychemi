/**
 * whatif-numbered-list.tsx — 번호 목록 공용 컴포넌트 (미니앱 포트)
 *
 * 웹앱 원본: src/components/whatif/whatif-numbered-list.tsx (next-intl + Tailwind)
 * 변경: 'use client' 제거, Tailwind → 인라인 스타일.
 */

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';

interface WhatifNumberedListProps {
  testid: string;
  titleKey: string;
  items: readonly string[];
}

export function WhatifNumberedList({ testid, titleKey, items }: WhatifNumberedListProps) {
  const t = useTranslations('whatif.result');
  return (
    <div
      data-testid={testid}
      style={{
        borderRadius: 'var(--r-lg)',
        backgroundColor: 'var(--primary-muted, color-mix(in srgb, var(--primary) 10%, transparent))',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <p style={{ font: 'var(--t-sub)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        {t(titleKey)}
      </p>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ font: 'var(--t-sub)', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
              {i + 1}
            </span>
            <span style={{ font: 'var(--t-sub)', color: 'var(--text-primary)' }}>
              {convertHanja(item)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
