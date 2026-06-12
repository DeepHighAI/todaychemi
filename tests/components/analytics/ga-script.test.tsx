// @vitest-environment jsdom
// G-8: GA 스크립트 로더 + SPA page_view 트래커 — env 부재 시 아무것도 렌더하지 않음

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('@/lib/analytics/ga', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/analytics/ga')>();
  return { ...mod, trackPageView: vi.fn() };
});

import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics/ga';
import { GaScript } from '@/components/analytics/ga-script';
import { GaPageView } from '@/components/analytics/ga-page-view';

describe('GaScript', () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it('env 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<GaScript />);
    expect(container.innerHTML).toBe('');
  });

  it('env 있으면 gtag init 인라인 스크립트를 렌더한다 (send_page_view:false)', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST1234');
    render(<GaScript />);
    // next/script 인라인은 jsdom 에서 document 에 주입됨
    const inline = document.getElementById('ga-init');
    expect(inline?.textContent).toContain('G-TEST1234');
    expect(inline?.textContent).toContain('send_page_view');
  });
});

describe('GaPageView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/feed');
  });

  it('마운트 시 현재 pathname 으로 trackPageView 호출', () => {
    render(<GaPageView />);
    expect(trackPageView).toHaveBeenCalledWith('/feed');
  });

  it('pathname 변경 시마다 다시 호출', () => {
    const { rerender } = render(<GaPageView />);
    vi.mocked(usePathname).mockReturnValue('/me');
    rerender(<GaPageView />);
    expect(trackPageView).toHaveBeenCalledWith('/me');
    expect(trackPageView).toHaveBeenCalledTimes(2);
  });
});
