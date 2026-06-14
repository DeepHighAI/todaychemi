/**
 * CtaBar.tsx — 온보딩 하단 고정 CTA 버튼 바
 *
 * 웹앱 원본: 각 step 페이지의 fixed bottom button.
 * 미니앱: 인라인 스타일, padding bottom 안전영역 대응.
 */

import { Button } from '@/components/ui/button';

interface CtaBarProps {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

export function CtaBar({ label, disabled = false, loading = false, onClick }: CtaBarProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        background: 'var(--background)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <Button
        variant="default"
        disabled={disabled || loading}
        onClick={onClick}
        style={{
          height: 48,
          width: '100%',
          borderRadius: 'var(--r-pill)',
          fontWeight: 700,
          fontSize: 16,
          maxWidth: 448,
          display: 'block',
          margin: '0 auto',
        }}
      >
        {label}
      </Button>
    </div>
  );
}
