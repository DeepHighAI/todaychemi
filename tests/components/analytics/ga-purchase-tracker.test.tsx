// @vitest-environment jsdom
// G-8: 결제 confirm 복귀(?paid=ref) → GA purchase 이벤트 — ref 원문 미전송(PII-safe), 멱등

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));
vi.mock('@/lib/analytics/ga', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/analytics/ga')>();
  return { ...mod, trackEvent: vi.fn() };
});

import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics/ga';
import { GaPurchaseTracker } from '@/components/analytics/ga-purchase-tracker';

function setup(pathname: string, query: Record<string, string>) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as never);
}

describe('GaPurchaseTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('?paid 없으면 이벤트 미발화', () => {
    setup('/hapcard/abc', {});
    render(<GaPurchaseTracker />);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('/hapcard + ?paid → purchase(hapcard, 1000 KRW)', () => {
    setup('/hapcard/abc', { paid: 'cache-key-xyz' });
    render(<GaPurchaseTracker />);
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'purchase',
      params: { feature_id: 'hapcard', value: 1000, currency: 'KRW' },
    });
  });

  it('/hapcard + ?replay=1&paid → purchase(replay, 600)', () => {
    setup('/hapcard/abc', { replay: '1', paid: 'replay:abc:2026-06-13' });
    render(<GaPurchaseTracker />);
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'purchase',
      params: { feature_id: 'replay', value: 600, currency: 'KRW' },
    });
  });

  it('/whatif + ?paid → purchase(whatif, 800)', () => {
    setup('/whatif/work', { paid: 'cache-key-w' });
    render(<GaPurchaseTracker />);
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'purchase',
      params: { feature_id: 'whatif', value: 800, currency: 'KRW' },
    });
  });

  it('/feed + ?paid → purchase(relation_slot, 1000)', () => {
    setup('/feed', { paid: 'relation_slot:pending-1' });
    render(<GaPurchaseTracker />);
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'purchase',
      params: { feature_id: 'relation_slot', value: 1000, currency: 'KRW' },
    });
  });

  it('같은 ref 로 재마운트해도 1회만 발화 (sessionStorage 멱등)', () => {
    setup('/hapcard/abc', { paid: 'cache-key-xyz' });
    const { unmount } = render(<GaPurchaseTracker />);
    unmount();
    render(<GaPurchaseTracker />);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('ref 원문은 파라미터로 전송하지 않는다 (PII-safe)', () => {
    setup('/hapcard/abc', { paid: 'cache-key-xyz' });
    render(<GaPurchaseTracker />);
    const call = vi.mocked(trackEvent).mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain('cache-key-xyz');
  });
});
