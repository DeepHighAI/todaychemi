/**
 * ErrorCard.tsx — 에러 상태 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/feedback/ErrorCard.tsx (next/link + Tailwind)
 * 미니앱: Link→<a>, Tailwind → 인라인 스타일, 'use client' 제거.
 */

import { type ErrorCode, ERROR_COPY, ERROR_CTA } from '@/lib/errors/error-codes';
import { Button } from '@/components/ui/button';

interface ErrorCardProps {
  code: ErrorCode;
  onRetry?: () => void;
  onReport?: () => void;
}

export function ErrorCard({ code, onRetry, onReport }: ErrorCardProps) {
  const cta = ERROR_CTA[code];
  return (
    <div
      data-testid="error-card"
      style={{
        borderRadius: 'var(--r-md)',
        backgroundColor: 'var(--warn-bg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <p style={{ font: 'var(--t-sub)', color: 'var(--warn)', margin: 0 }}>{ERROR_COPY[code]}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {cta && (
          // 미니앱 채널: 외부 자사 링크 금지 (§6.7). 정적 CTA 없으므로 이 경로는 사실상 미사용.
          // TODO(P5 IAP): IAP 결제 시트 연결 시 href 대신 onCta() 콜백으로 교체.
          <a
            href={cta.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 28,
              padding: '0 10px',
              borderRadius: 'var(--r-sm)',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {cta.label}
          </a>
        )}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            다시 시도
          </Button>
        )}
        {onReport && (
          <Button variant="ghost" size="sm" onClick={onReport}>
            제보
          </Button>
        )}
      </div>
    </div>
  );
}
