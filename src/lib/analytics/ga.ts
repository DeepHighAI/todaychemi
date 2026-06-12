// G-8 (2026-06-13 §1.1 확정: 분석 도구 = Google Analytics 4)
// gtag 헬퍼 — NEXT_PUBLIC_GA_MEASUREMENT_ID 부재 시 전 함수 no-op (GA 속성 설정은 개발 완료 후).
// PII 절대 금지: 이벤트 파라미터는 아래 GaEvent 화이트리스트 타입으로만 — 별명·생일·이메일·
// user_id·cache_key 등 식별자/원본 필드를 파라미터에 추가하지 말 것 (docs/legal/pii_minimization.md).

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// GA4 표준 이벤트명 우선 (sign_up/share/begin_checkout/purchase), 도메인 이벤트는 스네이크케이스
export type GaEvent =
  | { name: 'sign_up'; params: { method: 'email' | 'google' | 'kakao' } }
  | { name: 'onboarding_complete'; params?: undefined }
  | { name: 'relation_create'; params: { mode: string } }
  | { name: 'hapcard_view'; params: { mode: string } }
  | { name: 'whatif_view'; params: { diagnostic_type: string } }
  | { name: 'replay_create'; params?: undefined }
  | { name: 'share'; params: { method: string; content_type: 'hapcard' | 'today' } }
  | { name: 'begin_checkout'; params: { feature_id: string; value: number; currency: 'KRW' } }
  | { name: 'purchase'; params: { feature_id: string; value: number; currency: 'KRW' } };

export function gaMeasurementId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return id && id.length > 0 ? id : undefined;
}

export function isGaEnabled(): boolean {
  return typeof window !== 'undefined' && gaMeasurementId() !== undefined;
}

export function trackEvent(event: GaEvent): void {
  if (!isGaEnabled()) return;
  const gtag = window.gtag;
  if (typeof gtag !== 'function') return;
  gtag('event', event.name, event.params ?? {});
}

// App Router SPA 내비게이션용 수동 page_view (GaScript 의 send_page_view:false 와 페어)
export function trackPageView(pathname: string): void {
  if (!isGaEnabled()) return;
  const gtag = window.gtag;
  if (typeof gtag !== 'function') return;
  gtag('event', 'page_view', { page_path: pathname });
}
