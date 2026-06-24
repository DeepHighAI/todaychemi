/**
 * WhatifPage.tsx — 오늘의 나는?(자기진단 6모드) 뷰어
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

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { apiFetch, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useFeaturePurchase } from '@/components/iap/use-feature-purchase';
import { FeaturePayCard } from '@/components/iap/feature-pay-card';
import { IAP_DISPLAY_PRICE_KRW } from '@/lib/iap/prices';
import {
  shortageText,
  tokenUseConfirmText,
  type FeaturePreflightResponse,
} from '@/lib/payments/preflight';
import { ERROR_CODES, type ErrorCode } from '@/lib/errors/error-codes';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { WhatifHero } from '@/components/whatif/whatif-hero';
import { WhatifKeywords } from '@/components/whatif/whatif-keywords';
import { WhatifDoFirst } from '@/components/whatif/whatif-do-first';
import { WhatifFirstMeetTips } from '@/components/whatif/whatif-first-meet-tips';
import { WhatifClassicCitation } from '@/components/whatif/whatif-classic-citation';
import {
  WhatifAvoidTodayCard,
  WhatifSajuBasisCard,
  WhatifSituationReadingCard,
  WhatifTodayContextCard,
} from '@/components/whatif/whatif-rich-sections';
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

async function preflightWhatif(
  type: DiagnosticType,
  token: string | null,
): Promise<FeaturePreflightResponse> {
  return apiFetch<FeaturePreflightResponse>(`/api/whatif/${type}/preflight`, {
    method: 'POST',
    token,
  });
}

// ---------------------------------------------------------------------------
// 메인 페이지 컴포넌트 (routes.tsx 가 default export 없이 named import 사용)
// ---------------------------------------------------------------------------

export function WhatifPage() {
  const { type: rawType } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  // 유효하지 않은 type 이면 에러 단락
  const type = isDiagnosticType(rawType) ? (rawType as DiagnosticType) : null;

  const [canLoadWhatif, setCanLoadWhatif] = useState(false);
  const [tokenConfirm, setTokenConfirm] = useState<FeaturePreflightResponse | null>(null);
  const [preflightPay, setPreflightPay] = useState<FeaturePreflightResponse | null>(null);

  useEffect(() => {
    setCanLoadWhatif(false);
    setTokenConfirm(null);
    setPreflightPay(null);
  }, [type]);

  const preflight = useQuery<FeaturePreflightResponse, ApiError>({
    queryKey: ['whatif-preflight', type],
    queryFn: () => preflightWhatif(type as DiagnosticType, token),
    enabled: !!type && !canLoadWhatif,
    retry: false,
  });

  useEffect(() => {
    const result = preflight.data;
    if (!result) return;
    if (result.mode === 'unlocked') {
      setCanLoadWhatif(true);
      return;
    }
    if (result.mode === 'token_required') {
      setTokenConfirm(result);
      return;
    }
    if (result.mode === 'pay_required') {
      setPreflightPay(result);
    }
  }, [preflight.data]);

  const { data, isLoading, isError, error, refetch } = useQuery<WhatifResult, ApiError>({
    queryKey: ['whatif', type],
    queryFn: () => callWhatif(type as DiagnosticType, token),
    enabled: !!type && canLoadWhatif,
    retry: false,
  });

  const [payDismissed, setPayDismissed] = useState(false);
  const [payInfo, setPayInfo] = useState<{ amount_krw: number; feature: string; ref: string } | null>(null);
  const [refundConsent, setRefundConsent] = useState(false);

  useEffect(() => {
    if (!isError) return;
    const err = error as ApiError;
    if (err.status === 402 && err.payment) {
      setPayInfo(err.payment);
    }
  }, [isError, error]);

  // IAP 결제 훅 — 성공 시 쿼리 재실행
  const {
    purchase: openIapPurchase,
    isPurchasing,
    purchaseError: iapError,
    purchaseErrorMessage: iapErrorMessage,
    clearError: clearIapError,
  } = useFeaturePurchase({
    onSuccess: () => {
      setPayDismissed(false);
      setPayInfo(null);
      setPreflightPay(null);
      setCanLoadWhatif(true);
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

  if (tokenConfirm && !canLoadWhatif) {
    const tokenCost = tokenConfirm.token_cost ?? 0;
    return (
      <div style={{ padding: 16 }}>
        <LoadingState />
        <ConfirmDialog
          open
          title={tokenUseConfirmText(tokenCost)}
          confirmLabel="사용할께"
          cancelLabel="나중에 볼께"
          onConfirm={() => {
            setTokenConfirm(null);
            setCanLoadWhatif(true);
          }}
          onCancel={() => {
            setTokenConfirm(null);
            navigate(-1);
          }}
        />
      </div>
    );
  }

  if ((preflight.isLoading || (!canLoadWhatif && !preflightPay)) && !isError) {
    return (
      <div style={{ padding: 16 }}>
        <LoadingState />
      </div>
    );
  }

  if (preflight.isError && !canLoadWhatif) {
    return (
      <div style={{ padding: 16 }}>
        <ErrorCard code="INTERNAL_ERROR" onRetry={() => preflight.refetch()} />
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

  if (isError || preflightPay) {
    const err = error as ApiError;

    // 402 PAYMENT_REQUIRED → Toss IAP 시트 연결
    if (((isError && err.status === 402) || preflightPay) && !payDismissed) {
      const info = err?.payment ?? payInfo ?? preflightPay?.payment;
      const amountKrw = info?.amount_krw ?? IAP_DISPLAY_PRICE_KRW.whatif;
      return (
        <div style={{ padding: 16 }}>
          <FeaturePayCard
            testId="whatif-pay-required"
            tone="card"
            title="부적이 부족해요"
            description={preflightPay
              ? `${shortageText(preflightPay.balance, preflightPay.shortage)} 결제 후 바로 오늘의 나는? 결과를 확인할 수 있어요.`
              : `오늘의 나는? 결과를 보려면 ₩${amountKrw.toLocaleString()} 결제가 필요해요.`}
            amountKrw={amountKrw}
            consentChecked={refundConsent}
            onConsentChange={setRefundConsent}
            isPurchasing={isPurchasing}
            hasError={!!iapError}
            errorMessage={iapErrorMessage ?? undefined}
            payDisabled={!info}
            onPay={() => {
              clearIapError();
              if (info) openIapPurchase(info);
            }}
            onClose={() => {
              clearIapError();
              setPayDismissed(true);
              navigate(-1);
            }}
          />
        </div>
      );
    }

    if (!isError) return null;

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
      <WhatifTodayContextCard context={data.content.today_context} targetDate={data.target_date} />
      <WhatifSajuBasisCard basis={data.content.saju_basis} />
      <WhatifSituationReadingCard reading={data.content.situation_reading} />
      <WhatifDoFirst items={data.content.do_first} />
      <WhatifAvoidTodayCard items={data.content.avoid_today} />
      {data.type === 'first_meet' && data.content.first_meet_tips && (
        <WhatifFirstMeetTips tips={data.content.first_meet_tips} />
      )}
      <WhatifClassicCitation citations={data.content.classic_citation} />
    </main>
  );
}
