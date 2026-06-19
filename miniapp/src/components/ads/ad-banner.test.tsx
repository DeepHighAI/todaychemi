import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => {
  let supported = true;
  const destroy = vi.fn();
  const attachBanner = vi.fn(() => ({ destroy }));
  // isSupported 프로퍼티 부착
  (attachBanner as unknown as { isSupported: () => boolean }).isSupported = () => supported;
  const initialize = vi.fn((opts: { callbacks?: { onInitialized?: () => void } }) => {
    opts.callbacks?.onInitialized?.();
  });
  (initialize as unknown as { isSupported: () => boolean }).isSupported = () => supported;
  return {
    destroy,
    attachBanner,
    initialize,
    setSupported: (v: boolean) => {
      supported = v;
    },
  };
});

vi.mock('@apps-in-toss/web-framework', () => ({
  TossAds: { initialize: h.initialize, attachBanner: h.attachBanner, destroyAll: vi.fn() },
}));

import { AdBanner, resolveAdGroupId } from './ad-banner';

beforeEach(() => {
  vi.clearAllMocks();
  h.setSupported(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdBanner', () => {
  it('개발 환경에서만 테스트 광고 ID 로 폴백한다', () => {
    expect(resolveAdGroupId({ DEV: true, VITE_TOSS_AD_GROUP_ID: '' })).toBe('ait-ad-test-banner-id');
    expect(resolveAdGroupId({ DEV: false, VITE_TOSS_AD_GROUP_ID: '' })).toBeNull();
  });

  it('광고 그룹 ID 가 명시되면 환경과 무관하게 그 값을 사용한다', () => {
    expect(resolveAdGroupId({ DEV: false, VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' })).toBe('ad-prod-123');
  });

  it('미지원 환경(isSupported=false)에서는 아무것도 렌더하지 않는다 (빈 화면 방지)', () => {
    h.setSupported(false);
    render(<AdBanner />);
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
    expect(h.attachBanner).not.toHaveBeenCalled();
  });

  it('지원 환경에서는 width 100% + 96px 컨테이너를 렌더하고 테스트 광고 ID 로 배너를 부착한다', () => {
    render(<AdBanner />);
    const container = screen.getByTestId('ad-banner');
    expect(container).toBeInTheDocument();
    expect(container.style.width).toBe('100%');
    expect(container.style.height).toBe('96px');
    expect(h.attachBanner).toHaveBeenCalledWith(
      'ait-ad-test-banner-id',
      container,
      expect.objectContaining({ variant: 'expanded' }),
    );
  });

  it('언마운트 시 배너를 destroy 한다', () => {
    const { unmount } = render(<AdBanner />);
    unmount();
    expect(h.destroy).toHaveBeenCalledTimes(1);
  });
});
