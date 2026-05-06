'use client';

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
        <div data-testid="loading-timeout-card" className="rounded-2xl bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{ERROR_COPY.LLM_TIMEOUT}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="loading-state">
      <div data-testid="loading-skeleton" className="animate-pulse space-y-3">
        <div className="h-8 bg-muted rounded-xl" />
        <div className="h-4 bg-muted rounded-xl w-3/4" />
        <div className="h-4 bg-muted rounded-xl w-1/2" />
      </div>
      {phase === 'slow' && (
        <p className="text-xs text-muted-foreground text-center mt-4">조금 더 걸리고 있어요</p>
      )}
    </div>
  );
}
