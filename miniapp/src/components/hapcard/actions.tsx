/**
 * actions.tsx — 케미카드 액션 목록 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/actions.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거.
 * ADR-038: convertHanja() 안전망 — 액션 텍스트에 한자 포함 가능.
 */

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';

interface HapcardActionsProps {
  actions: string[];
}

export function HapcardActions({ actions }: HapcardActionsProps) {
  const t = useTranslations('hapcard');

  if (actions.length === 0) {
    return (
      <div data-testid="hapcard-actions" style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 24 }}>
        <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>{t('actionsList.empty')}</p>
      </div>
    );
  }

  return (
    <div data-testid="hapcard-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {actions.map((action, i) => (
        <div
          key={i}
          style={{
            borderRadius: 16,
            backgroundColor: i === 0 ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--bg-card)',
            border: i === 0 ? '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' : '1px solid var(--hairline)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <p style={{ font: 'var(--t-cap)', color: 'var(--primary)', margin: 0 }}>{i + 1}</p>
          {/* LLM 출력 액션 문자열 — 한자 안전망 적용 (ADR-038) */}
          <p style={{ font: i === 0 ? 'var(--t-h3)' : 'var(--t-body)', color: 'var(--text-primary)', margin: 0 }}>
            {convertHanja(action)}
          </p>
        </div>
      ))}
    </div>
  );
}
