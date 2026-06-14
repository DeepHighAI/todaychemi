/**
 * ai-disclosure-notice.tsx — AI 사전 고지 섹션 (미니앱 포트, §6.4 법적 의무)
 *
 * 웹앱 원본: src/components/ai-disclosure/ai-disclosure-notice.tsx (next-intl + Tailwind)
 * 미니앱: Tailwind → 인라인 스타일, 'use client' 제거.
 * 온보딩 최초 1회 AI 생성 고지 — 결과 화면의 배지와 짝을 이루는 본문 안내 (1G).
 */

import { useTranslations } from 'next-intl';
import { AiDisclosureBadge } from './ai-disclosure-badge';

interface AiDisclosureNoticeProps {
  className?: string;
}

export function AiDisclosureNotice({ className = '' }: AiDisclosureNoticeProps) {
  const t = useTranslations('aiDisclosure');
  return (
    <section
      data-testid="ai-disclosure-notice"
      className={className}
      style={{
        borderRadius: 'var(--r-md)',
        backgroundColor: 'var(--muted)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AiDisclosureBadge tone="light" />
        <h2 style={{ font: 'var(--t-cap)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('notice.title')}
        </h2>
      </div>
      <p style={{ fontSize: 12, lineHeight: '20px', color: 'var(--text-secondary)', margin: 0 }}>
        {t('notice.body')}
      </p>
    </section>
  );
}
