// @vitest-environment jsdom
// G-8 (2026-06-13 §1.1: 분석 도구 = Google Analytics): gtag 헬퍼 — env 부재 시 no-op

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isGaEnabled, trackEvent, trackPageView } from '@/lib/analytics/ga';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

describe('ga 헬퍼 — no-op 가드', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete window.gtag;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.gtag;
  });

  it('NEXT_PUBLIC_GA_MEASUREMENT_ID 없으면 isGaEnabled=false', () => {
    expect(isGaEnabled()).toBe(false);
  });

  it('env 없으면 trackEvent는 throw 없이 no-op (gtag 미호출)', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    expect(() => trackEvent({ name: 'onboarding_complete' })).not.toThrow();
    expect(gtag).not.toHaveBeenCalled();
  });

  it('env 있어도 window.gtag 미로드면 throw 없이 no-op (스크립트 차단 대비)', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST1234');
    expect(() => trackEvent({ name: 'onboarding_complete' })).not.toThrow();
  });

  it('env + gtag 존재 시 gtag("event", name, params) 호출', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST1234');
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent({ name: 'sign_up', params: { method: 'email' } });
    expect(gtag).toHaveBeenCalledWith('event', 'sign_up', { method: 'email' });
  });

  it('params 없는 이벤트는 빈 객체로 전송', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST1234');
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent({ name: 'onboarding_complete' });
    expect(gtag).toHaveBeenCalledWith('event', 'onboarding_complete', {});
  });

  it('begin_checkout — feature_id/value/currency 파라미터 전송', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST1234');
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent({ name: 'begin_checkout', params: { feature_id: 'hapcard', value: 1000, currency: 'KRW' } });
    expect(gtag).toHaveBeenCalledWith('event', 'begin_checkout', {
      feature_id: 'hapcard',
      value: 1000,
      currency: 'KRW',
    });
  });

  it('trackPageView — page_view 이벤트로 pathname 전송', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST1234');
    const gtag = vi.fn();
    window.gtag = gtag;
    trackPageView('/feed');
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', { page_path: '/feed' });
  });
});
