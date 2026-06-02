'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { DiagnosticType, WhatifResult } from '@/types/diagnostic';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { FeaturePaySheet } from '@/components/payments/feature-pay-sheet';
import { ERROR_CODES, type ErrorCode } from '@/lib/errors/error-codes';
import { WhatifHero } from '@/components/whatif/whatif-hero';
import { WhatifKeywords } from '@/components/whatif/whatif-keywords';
import { WhatifDoFirst } from '@/components/whatif/whatif-do-first';
import { WhatifFirstMeetTips } from '@/components/whatif/whatif-first-meet-tips';
import { WhatifClassicCitation } from '@/components/whatif/whatif-classic-citation';

async function callWhatif(type: DiagnosticType): Promise<WhatifResult> {
  const res = await fetch(`/api/whatif/${type}`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = (body?.error?.code ?? 'INTERNAL_ERROR') as string;
    // 402 PAYMENT_REQUIRED 는 결제 시트에 필요한 ref/amount 를 함께 실어 보낸다.
    throw Object.assign(new Error(code), {
      code,
      feature: body?.feature,
      ref: body?.ref,
      amount_krw: body?.amount_krw,
    });
  }
  return res.json() as Promise<WhatifResult>;
}

export function WhatifView() {
  const params = useParams<{ type: string }>();
  const type = params.type as DiagnosticType;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['whatif', type],
    queryFn: () => callWhatif(type),
    enabled: !!type,
    retry: false,
  });
  const [payDismissed, setPayDismissed] = useState(false);

  if (isLoading) return <LoadingState />;

  if (isError) {
    const err = error as { code?: string; ref?: string };
    // 402 PAYMENT_REQUIRED → 결제 시트 (ErrorCard 보다 먼저 가로채기). 닫으면 ErrorCard fallback.
    if (err.code === 'PAYMENT_REQUIRED' && !payDismissed) {
      return (
        <FeaturePaySheet
          feature="whatif"
          featureRef={err.ref ?? ''}
          next={`/whatif/${type}`}
          open
          onOpenChange={(o) => {
            if (!o) setPayDismissed(true);
          }}
          onPaid={() => refetch()}
        />
      );
    }
    // 그 외 에러는 ErrorCard 로 통합 처리 (CTA 는 error-codes.ts 기반)
    const safeCode = ERROR_CODES.includes(err.code as ErrorCode)
      ? (err.code as ErrorCode)
      : 'INTERNAL_ERROR';
    return <ErrorCard code={safeCode} onRetry={() => refetch()} />;
  }

  if (!data) return null;

  return (
    <main data-testid="whatif-view" className="space-y-4 p-4">
      <WhatifHero type={data.type} body={data.content.body} />
      <WhatifKeywords keywords={data.content.keywords} />
      <WhatifDoFirst items={data.content.do_first} />
      {data.type === 'first_meet' && data.content.first_meet_tips && (
        <WhatifFirstMeetTips tips={data.content.first_meet_tips} />
      )}
      <WhatifClassicCitation citations={data.content.classic_citation} />
    </main>
  );
}
