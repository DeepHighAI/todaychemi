'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { DiagnosticType, WhatifResult } from '@/types/diagnostic';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
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
    throw Object.assign(new Error(code), { code });
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

  if (isLoading) return <LoadingState />;

  if (isError) {
    const code = (error as { code?: string })?.code;
    // 모든 에러를 ErrorCard로 통합 처리 (CTA 링크는 ErrorCard 내부에서 error-codes.ts 기반 처리)
    const safeCode = ERROR_CODES.includes(code as ErrorCode) ? (code as ErrorCode) : 'INTERNAL_ERROR';
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
