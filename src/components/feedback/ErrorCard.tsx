'use client';

import { Button } from '@/components/ui/button';
import { type ErrorCode, ERROR_COPY } from '@/lib/errors/error-codes';

interface ErrorCardProps {
  code: ErrorCode;
  onRetry?: () => void;
  onReport?: () => void;
}

export function ErrorCard({ code, onRetry, onReport }: ErrorCardProps) {
  return (
    <div data-testid="error-card" className="rounded-2xl bg-destructive/10 p-4 space-y-3">
      <p className="text-sm text-destructive">{ERROR_COPY[code]}</p>
      <div className="flex gap-2 flex-wrap">
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
