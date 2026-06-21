/**
 * WhatifPage.tsx — 또 다른 나(자기진단 6모드) 뷰어
 *
 * 웹앱 원본: src/app/(app)/whatif/[type]/WhatifView.tsx (next/navigation + Tailwind)
 *
 * 변경 사항:
 * - useParams: next/navigation → react-router-dom
 * - fetch → apiFetch (apiFetch 는 Bearer 자동 첨부)
 * - FeaturePaySheet 제거 → 402 시 Toss IAP 시트(useFeaturePurchase) 연결
 * - 'use client' 제거 (Vite SPA — 전체 클라이언트)
 * - Tailwind → 인라인 스타일
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { apiFetch, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useFeaturePurchase } from '@/components/iap/use-feature-purchase';
import { FeaturePayCard } from '@/components/iap/feature-pay-card';
import { IAP_DISPLAY_PRICE_KRW } from '@/lib/iap/prices';
import { ERROR_CODES, type ErrorCode } from '@/lib/errors/error-codes';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { WhatifHero } from '@/components/whatif/whatif-hero';
import { WhatifKeywords } from '@/components/whatif/whatif-keywords';
import { WhatifDoFirst } from '@/components/whatif/whatif-do-first';
import { WhatifFirstMeetTips } from '@/components/whatif/whatif-first-meet-tips';
import { WhatifClassicCitation } from '@/components/whatif/whatif-classic-citation';
import { isDiagnosticType, type DiagnosticType, type WhatifResult } from '@/types/diagnostic';

// ---------------------------------------------------------------------------
// API 호출
// ---------------------------------------------------------------------------

async function callWhatif(type: DiagnosticType, token: string | null): Promise<WhatifResult> {
  // 402 PAYMENT_REQUIRED 는 ApiError(status=402) 로 throw 됨.
  // apiFetch 는 ok 아닐 때 ApiError 를 throw 하므로 별도 처리 불필요.
  return apiFetch<WhatifResult>(`/api/whatif/${type}`, {
    method: 'POST',
    token,
  });
}

// ---------------------------------------------------------------------------
// 메인 페이지 컴포넌트 (routes.tsx 가 default export 없이 named import 사용)
// ---------------------------------------------------------------------------

export function WhatifPage() {
  const { type: rawType } = useParams<{ type: string }>();
  const { token } = useAuth();

  // 유효하지 않은 type 이면 에러 단락
  const type = isDiagnosticType(rawType) ? (rawType as DiagnosticType) : null;

  const { data, isLoading, isError, error, refetch } = useQuery<WhatifResult, ApiError>({
    queryKey: ['whatif', type],
    queryFn: () => callWhatif(type as DiagnosticType, token),
    enabled: !!type,
    retry: false,
  });

  const [payDismissed, setPayDismissed] = useState(false);
  const [payInfo, setPayInfo] = useState<{ amount_krw: number; feature: string; ref: string } | null>(null);
  const [refundConsent, setRefundConsent] = useState(false);

  // IAP 결제 훅 — 성공 시 쿼리 재실행
  const { purchase: openIapPurchase, isPurchasing, purchaseError: iapError, clearError: clearIapError } = useFeaturePurchase({
    onSuccess: () => {
      setPayDismissed(false);
      setPayInfo(null);
      void refetch();
    },
  });

  // 유효하지 않은 type
  if (!type) {
    return (
      <div style={{ padding: 24 }}>
        <ErrorCard code="INTERNAL_ERROR" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    const err = error as ApiError;

    // 402 PAYMENT_REQUIRED → Toss IAP 시트 연결
    if (err.status === 402 && !payDismissed) {
      // 402 발생 시 payment 정보 저장
      const info = err.payment ?? payInfo;
      if (info && !payInfo) setPayInfo(info);
      const amountKrw = info?.amount_krw ?? IAP_DISPLAY_PRICE_KRW.whatif;
      return (
        <div style={{ padding: 16 }}>
          <FeaturePayCard
            testId="whatif-pay-required"
            tone="card"
            title="또 다른 나 결과를 보려면 결제가 필요해요."
            description={`₩${amountKrw.toLocaleString()} / 1회`}
            amountKrw={amountKrw}
            consentChecked={refundConsent}
            onConsentChange={setRefundConsent}
            isPurchasing={isPurchasing}
            hasError={!!iapError}
            onPay={() => {
              clearIapError();
              if (info) openIapPurchase(info);
            }}
            onClose={() => { clearIapError(); setPayDismissed(true); }}
          />
        </div>
      );
    }

    // 그 외 에러 → ErrorCard
    const safeCode: ErrorCode =
      err.code !== 'PAYMENT_REQUIRED' && ERROR_CODES.includes(err.code as ErrorCode)
        ? (err.code as ErrorCode)
        : 'INTERNAL_ERROR';

    return (
      <div style={{ padding: 16 }}>
        <ErrorCard code={safeCode} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <main
      data-testid="whatif-view"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}
    >
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
