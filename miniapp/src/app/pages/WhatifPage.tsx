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
import { RefundRestrictionConsent } from '@/components/iap/refund-consent';
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
// 402 결제 필요 UI — Toss IAP 시트 연결
// ---------------------------------------------------------------------------

interface PayRequiredBlockProps {
  amountKrw: number;
  onPurchase: () => void;
  onDismiss: () => void;
  isPurchasing: boolean;
  purchaseError: Error | null;
}

function PayRequiredBlock({ amountKrw, onPurchase, onDismiss, isPurchasing, purchaseError }: PayRequiredBlockProps) {
  const [refundConsent, setRefundConsent] = useState(false);
  return (
    <div
      data-testid="whatif-pay-required"
      style={{
        borderRadius: 'var(--r-lg)',
        backgroundColor: 'var(--bg-card)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <p style={{ font: 'var(--t-body)', color: 'var(--text-primary)', margin: 0 }}>
        또 다른 나 결과를 보려면 결제가 필요해요.
      </p>
      <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0 }}>
        ₩{amountKrw.toLocaleString()} / 1회
      </p>
      {purchaseError && (
        <p style={{ font: 'var(--t-cap)', color: 'var(--destructive)', margin: 0 }}>
          결제 중 오류가 발생했어요. 다시 시도해 주세요.
        </p>
      )}
      <RefundRestrictionConsent checked={refundConsent} onCheckedChange={setRefundConsent} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onPurchase}
          disabled={isPurchasing || !refundConsent}
          style={{
            borderRadius: 'var(--r-md)',
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            font: 'var(--t-sub)',
            fontWeight: 600,
            padding: '10px 20px',
            border: 'none',
            cursor: isPurchasing || !refundConsent ? 'not-allowed' : 'pointer',
            opacity: isPurchasing || !refundConsent ? 0.6 : 1,
          }}
        >
          {isPurchasing ? '결제 중…' : `₩${amountKrw.toLocaleString()} 결제하기`}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            borderRadius: 'var(--r-md)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            font: 'var(--t-sub)',
            padding: '10px 16px',
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
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
      return (
        <div style={{ padding: 16 }}>
          <PayRequiredBlock
            amountKrw={info?.amount_krw ?? IAP_DISPLAY_PRICE_KRW.whatif}
            isPurchasing={isPurchasing}
            purchaseError={iapError}
            onPurchase={() => {
              clearIapError();
              if (info) openIapPurchase(info);
            }}
            onDismiss={() => { clearIapError(); setPayDismissed(true); }}
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
