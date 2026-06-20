/**
 * EmptyState.tsx — 빈 상태 안내 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/feedback/EmptyState.tsx (Tailwind)
 * 미니앱: Tailwind → 인라인 스타일, 'use client' 제거.
 */

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  body?: string;
  cta?: string;
  onCta?: () => void;
}

export function EmptyState({ title, body, cta, onCta }: EmptyStateProps) {
  return (
    <div data-testid="empty-state" style={{ padding: '0 16px' }}>
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--r-md)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 12,
        }}
      >
        <p style={{ font: 'var(--t-h3)', color: 'var(--text-primary)', margin: 0 }}>{title}</p>
        {body && (
          <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>{body}</p>
        )}
        {cta && onCta && (
          <Button variant="default" className="btn-cta" onClick={onCta}>
            {cta}
          </Button>
        )}
      </div>
    </div>
  );
}
