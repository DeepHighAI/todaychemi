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
  /** 'slow' 보조 문구 노출까지 대기(ms). 기본 10s. */
  slowAfterMs?: number;
  /** 'timeout' 단계 전환까지 대기(ms). 기본 20s. */
  timeoutAfterMs?: number;
  /** timeout 단계에 보여줄 문구. 기본은 LLM_TIMEOUT 경고 카피. */
  timeoutMessage?: string;
  /** timeout 카드 톤. 'warn'(기본)=경고색 / 'info'=중립(아직 생성 중인 안심형). */
  timeoutTone?: 'warn' | 'info';
}

type Phase = 'skeleton' | 'slow' | 'timeout';

export function LoadingState({
  onTimeout,
  slowAfterMs = 10_000,
  timeoutAfterMs = 20_000,
  timeoutMessage = ERROR_COPY.LLM_TIMEOUT,
  timeoutTone = 'warn',
}: LoadingStateProps) {
  const [phase, setPhase] = useState<Phase>('skeleton');

  useEffect(() => {
    const slowTimer = setTimeout(() => setPhase('slow'), slowAfterMs);
    const timeoutTimer = setTimeout(() => {
      setPhase('timeout');
      onTimeout?.();
    }, timeoutAfterMs);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
    };
  }, [onTimeout, slowAfterMs, timeoutAfterMs]);

  if (phase === 'timeout') {
    const isWarn = timeoutTone === 'warn';
    return (
      <div data-testid="loading-state">
        <div
          data-testid="loading-timeout-card"
          style={{
            borderRadius: 'var(--r-md)',
            backgroundColor: isWarn ? 'var(--warn-bg)' : 'var(--bg-card)',
            padding: 16,
          }}
        >
          <p style={{
            font: 'var(--t-sub)',
            color: isWarn ? 'var(--warn)' : 'var(--text-secondary)',
            textAlign: isWarn ? 'left' : 'center',
            margin: 0,
          }}>
            {timeoutMessage}
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
