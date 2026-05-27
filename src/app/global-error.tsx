'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="mb-2 text-base font-semibold text-foreground">오류가 발생했어요.</p>
        <p className="mb-6 text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
        <button
          type="button"
          className="rounded-[var(--r-sm)] bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          onClick={reset}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
