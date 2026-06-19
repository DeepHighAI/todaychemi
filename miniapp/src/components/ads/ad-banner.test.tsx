import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => {
  let supported = true;
  let initCalls = 0;
  // 기본: 최악 시나리오 — SDK 가 "첫 initialize 호출"의 onInitialized 만 발화한다고 가정.
  // (공식 문서가 중복 init 마다 onInitialized 를 발화한다고 보장하지 않으므로 이 가정으로 검증)
  let fireOnlyFirstInit = true;
  const destroy = vi.fn();
  const attachBanner = vi.fn(() => ({ destroy }));
  // isSupported 프로퍼티 부착
  (attachBanner as unknown as { isSupported: () => boolean }).isSupported = () => supported;
  const initialize = vi.fn((opts: { callbacks?: { onInitialized?: () => void } }) => {
    initCalls += 1;
    if (!fireOnlyFirstInit || initCalls === 1) {
      opts.callbacks?.onInitialized?.();
    }
  });
  (initialize as unknown as { isSupported: () => boolean }).isSupported = () => supported;
  return {
    destroy,
    attachBanner,
    initialize,
    setSupported: (v: boolean) => {
      supported = v;
    },
    resetInitCalls: () => {
      initCalls = 0;
    },
    setFireOnlyFirstInit: (v: boolean) => {
      fireOnlyFirstInit = v;
    },
  };
});

vi.mock('@apps-in-toss/web-framework', () => ({
  TossAds: { initialize: h.initialize, attachBanner: h.attachBanner, destroyAll: vi.fn() },
}));

import { AdBanner, isAdSlotAvailable, resolveAdGroupId, __resetTossAdsForTest } from './ad-banner';

beforeEach(() => {
  vi.clearAllMocks();
  h.setSupported(true);
  h.resetInitCalls();
  h.setFireOnlyFirstInit(true);
  __resetTossAdsForTest();
});

afterEach(() => {
  vi.clearAllMocks();
  __resetTossAdsForTest();
});

describe('resolveAdGroupId', () => {
  it('개발 환경에서만 테스트 광고 ID 로 폴백한다', () => {
    expect(resolveAdGroupId({ DEV: true, VITE_TOSS_AD_GROUP_ID: '' })).toBe('ait-ad-test-banner-id');
    expect(resolveAdGroupId({ DEV: false, VITE_TOSS_AD_GROUP_ID: '' })).toBeNull();
  });

  it('광고 그룹 ID 가 명시되면 환경과 무관하게 그 값을 사용한다', () => {
    expect(resolveAdGroupId({ DEV: false, VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' })).toBe('ad-prod-123');
  });
});

describe('isAdSlotAvailable', () => {
  it('지원 + 광고 그룹 ID 가 있으면 true', () => {
    h.setSupported(true);
    expect(isAdSlotAvailable({ DEV: true, VITE_TOSS_AD_GROUP_ID: '' })).toBe(true);
  });

  it('지원하지만 광고 그룹 ID 가 없으면 false (프로덕션 env 미설정 — 빈 래퍼 방지)', () => {
    h.setSupported(true);
    expect(isAdSlotAvailable({ DEV: false, VITE_TOSS_AD_GROUP_ID: '' })).toBe(false);
  });

  it('미지원 환경이면 false', () => {
    h.setSupported(false);
    expect(isAdSlotAvailable({ DEV: true, VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' })).toBe(false);
  });
});

describe('AdBanner', () => {
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

  it('SDK 초기화는 앱 전역 1회만 수행하고, 여러 배너가 공유 ready 로 모두 부착된다 (F1 회귀 가드)', () => {
    // 최악 시나리오: SDK 가 첫 init 의 onInitialized 만 발화(fireOnlyFirstInit=true 기본).
    // 인스턴스별 init 이라면 2번째 배너는 attach 누락 → 이 테스트가 실패한다.
    render(
      <>
        <AdBanner />
        <AdBanner />
      </>,
    );
    // 싱글톤: 배너가 2개여도 initialize 는 정확히 1회.
    expect(h.initialize).toHaveBeenCalledTimes(1);
    // 공유 ready 로 두 배너 모두 부착.
    expect(h.attachBanner).toHaveBeenCalledTimes(2);
  });

  it('언마운트 시 배너를 destroy 한다', () => {
    const { unmount } = render(<AdBanner />);
    unmount();
    expect(h.destroy).toHaveBeenCalledTimes(1);
  });
});
