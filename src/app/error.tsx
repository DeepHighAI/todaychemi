'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-base font-semibold text-foreground mb-2">오류가 발생했어요.</p>
        <p className="text-sm text-muted-foreground mb-6">
          잠시 후 다시 시도해주세요.
        </p>
        <Button variant="default" onClick={reset}>
          다시 시도
        </Button>
      </body>
    </html>
  );
}
