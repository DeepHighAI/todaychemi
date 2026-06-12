'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { trackEvent } from '@/lib/analytics/ga';
import { FEATURE_PRICES_KRW, type FeatureId } from '@/lib/payments/feature-prices';

// G-8: 결제 confirm 303 복귀(?paid=ref) → GA purchase 이벤트.
// feature 판별은 confirm allowlist 경로 기반 — ref 원문(cache_key 등 식별자)은 GA 로 보내지 않는다.
// sessionStorage 멱등: 같은 ref 로는 1회만 발화 (새로고침·리마운트 중복 방지).
const DEDUP_PREFIX = 'ga_purchase_';

function featureFromLocation(pathname: string, hasReplayParam: boolean): FeatureId | null {
  if (pathname.startsWith('/hapcard')) return hasReplayParam ? 'replay' : 'hapcard';
  if (pathname.startsWith('/whatif')) return 'whatif';
  if (pathname.startsWith('/feed')) return 'relation_slot';
  return null;
}

export function GaPurchaseTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paidRef = searchParams?.get('paid') ?? null;
  const hasReplayParam = searchParams?.get('replay') !== null && searchParams?.get('replay') !== undefined;

  useEffect(() => {
    if (!paidRef || !pathname) return;

    const dedupKey = `${DEDUP_PREFIX}${paidRef}`;
    try {
      if (window.sessionStorage.getItem(dedupKey)) return;
      window.sessionStorage.setItem(dedupKey, '1');
    } catch {
      // sessionStorage 차단 환경 — 멱등 보장 없이 발화 (분석 이벤트라 치명적이지 않음)
    }

    const feature = featureFromLocation(pathname, hasReplayParam);
    if (!feature) return;

    trackEvent({
      name: 'purchase',
      params: { feature_id: feature, value: FEATURE_PRICES_KRW[feature].amount_krw, currency: 'KRW' },
    });
  }, [paidRef, pathname, hasReplayParam]);

  return null;
}
