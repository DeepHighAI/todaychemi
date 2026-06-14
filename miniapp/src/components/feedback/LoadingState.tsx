/**
 * LoadingState.tsx — 로딩 스켈레톤 + 타임아웃 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/feedback/LoadingState.tsx (Tailwind)
 * 미니앱: Tailwind → 인라인 스타일, 'use client' 제거.
 */

import { useEffect, useState } from 'react';
import { ERROR_COPY } from '@/lib/errors/error-codes';

interface LoadingStateProps {
  onTimeout?: () => void;
}

type Phase = 'skeleton' | 'slow' | 'timeout';

export function LoadingState({ onTimeout }: LoadingStateProps) {
  const [phase, setPhase] = useState<Phase>('skeleton');

  useEffect(() => {
    const slowTimer = setTimeout(() => setPhase('slow'), 10_000);
    const timeoutTimer = setTimeout(() => {
      setPhase('timeout');
      onTimeout?.();
    }, 20_000);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
    };
  }, [onTimeout]);

  if (phase === 'timeout') {
    return (
      <div data-testid="loading-state">
        <div
          data-testid="loading-timeout-card"
          style={{
            borderRadius: 'var(--r-md)',
            backgroundColor: 'var(--warn-bg)',
            padding: 16,
          }}
        >
          <p style={{ font: 'var(--t-sub)', color: 'var(--warn)', margin: 0 }}>
            {ERROR_COPY.LLM_TIMEOUT}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="loading-state">
      <div
        data-testid="loading-skeleton"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{
          height: 32,
          backgroundColor: 'var(--muted)',
          borderRadius: 'var(--r-sm)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 16,
          width: '75%',
          backgroundColor: 'var(--muted)',
          borderRadius: 'var(--r-sm)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 16,
          width: '50%',
          backgroundColor: 'var(--muted)',
          borderRadius: 'var(--r-sm)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
      {phase === 'slow' && (
        <p style={{
          font: 'var(--t-sub)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: 16,
        }}>
          조금 더 걸리고 있어요
        </p>
      )}
    </div>
  );
}
