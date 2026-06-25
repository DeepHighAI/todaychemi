'use client';

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
          className={`rounded-[var(--r-md)] p-4 ${isWarn ? 'bg-[var(--warn-bg)]' : 'bg-card'}`}
        >
          <p className={`font-sub ${isWarn ? 'text-[var(--warn)]' : 'text-muted-foreground text-center'}`}>
            {timeoutMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="loading-state">
      <div data-testid="loading-skeleton" className="animate-pulse space-y-3">
        <div className="h-8 bg-muted rounded-[var(--r-sm)]" />
        <div className="h-4 bg-muted rounded-[var(--r-sm)] w-3/4" />
        <div className="h-4 bg-muted rounded-[var(--r-sm)] w-1/2" />
      </div>
      {phase === 'slow' && (
        <p className="font-sub text-muted-foreground text-center mt-4">조금 더 걸리고 있어요</p>
      )}
    </div>
  );
}
