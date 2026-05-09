'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type ErrorCode, ERROR_COPY, ERROR_CTA } from '@/lib/errors/error-codes';

interface ErrorCardProps {
  code: ErrorCode;
  onRetry?: () => void;
  onReport?: () => void;
}

export function ErrorCard({ code, onRetry, onReport }: ErrorCardProps) {
  // 에러 코드에 대응하는 CTA(충전하러 가기 등) 링크 조회
  const cta = ERROR_CTA[code];
  return (
    <div data-testid="error-card" className="rounded-2xl bg-destructive/10 p-4 space-y-3">
      <p className="text-sm text-destructive">{ERROR_COPY[code]}</p>
      <div className="flex gap-2 flex-wrap">
        {cta && (
          // base-ui Button은 asChild 미지원 — buttonVariants 직접 적용
          <Link href={cta.href} className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}>
            {cta.label}
          </Link>
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
