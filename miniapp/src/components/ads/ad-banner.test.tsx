import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => {
  let initializeSupported = true;
  let attachSupported = true;
  let initCalls = 0;
  // 기본: 최악 시나리오 — SDK 가 "첫 initialize 호출"의 onInitialized 만 발화한다고 가정.
  // (공식 문서가 중복 init 마다 onInitialized 를 발화한다고 보장하지 않으므로 이 가정으로 검증)
  let fireOnlyFirstInit = true;
  let attachThrows = false;
  let lastAdGroupId = 'ad-prod-123';
  type BannerEventPayload = {
    slotId: string;
    adGroupId: string;
    adMetadata: { creativeId: string; requestId: string };
  };
  let lastAttachOptions:
    | {
        callbacks?: {
          onAdRendered?: (payload: BannerEventPayload) => void;
          onAdImpression?: (payload: BannerEventPayload) => void;
          onAdViewable?: (payload: BannerEventPayload) => void;
          onAdClicked?: (payload: BannerEventPayload) => void;
          onNoFill?: (payload: { slotId: string; adGroupId: string; adMetadata: {} }) => void;
          onAdFailedToRender?: (payload: {
            slotId: string;
            adGroupId: string;
            adMetadata: {};
            error: { code: number; message: string; domain?: string };
          }) => void;
        };
      }
    | undefined;
  const destroy = vi.fn();
  const attachBanner = vi.fn((adGroupId: string, _target: HTMLElement, options: NonNullable<typeof lastAttachOptions>) => {
    if (attachThrows) throw new Error('attach failed');
    lastAdGroupId = adGroupId;
    lastAttachOptions = options;
    return { destroy };
  });
  // isSupported 프로퍼티 부착
  (attachBanner as unknown as { isSupported: () => boolean }).isSupported = () => attachSupported;
  const initialize = vi.fn((opts: { callbacks?: { onInitialized?: () => void } }) => {
    initCalls += 1;
    if (!fireOnlyFirstInit || initCalls === 1) {
      opts.callbacks?.onInitialized?.();
    }
  });
  (initialize as unknown as { isSupported: () => boolean }).isSupported = () => initializeSupported;
  const getTossAppVersion = vi.fn(() => '5.241.0');
  return {
    destroy,
    attachBanner,
    initialize,
    getTossAppVersion,
    setSupported: (v: boolean) => {
      initializeSupported = v;
      attachSupported = v;
    },
    setInitializeSupported: (v: boolean) => {
      initializeSupported = v;
    },
    setAttachSupported: (v: boolean) => {
      attachSupported = v;
    },
    resetInitCalls: () => {
      initCalls = 0;
    },
    setFireOnlyFirstInit: (v: boolean) => {
      fireOnlyFirstInit = v;
    },
    setAttachThrows: (v: boolean) => {
      attachThrows = v;
    },
    resetAttachState: () => {
      attachThrows = false;
      lastAdGroupId = 'ad-prod-123';
      lastAttachOptions = undefined;
    },
    fireBannerEvent: (name: 'onAdRendered' | 'onAdImpression' | 'onAdViewable' | 'onAdClicked') => {
      lastAttachOptions?.callbacks?.[name]?.({
        slotId: 'slot-1',
        adGroupId: lastAdGroupId,
        adMetadata: { creativeId: 'c1', requestId: 'r1' },
      });
    },
    triggerNoFill: () => {
      lastAttachOptions?.callbacks?.onNoFill?.({
        slotId: 'slot-1',
        adGroupId: lastAdGroupId,
        adMetadata: {},
      });
    },
    triggerAdFailedToRender: () => {
      lastAttachOptions?.callbacks?.onAdFailedToRender?.({
        slotId: 'slot-1',
        adGroupId: lastAdGroupId,
        adMetadata: {},
        error: { code: 500, message: 'render failed', domain: 'test' },
      });
    },
  };
});

vi.mock('@apps-in-toss/web-framework', () => ({
  TossAds: { initialize: h.initialize, attachBanner: h.attachBanner, destroyAll: vi.fn() },
  getTossAppVersion: h.getTossAppVersion,
}));

import {
  AdBanner,
  AdBannerListItem,
  AdBannerSlot,
  ensureTossAdsInitialized,
  isAdSlotAvailable,
  resolveAdGroupId,
  __resetTossAdsForTest,
} from './ad-banner';

beforeEach(() => {
  vi.clearAllMocks();
  h.setSupported(true);
  h.resetInitCalls();
  h.setFireOnlyFirstInit(true);
  h.resetAttachState();
  h.getTossAppVersion.mockReturnValue('5.241.0');
  __resetTossAdsForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  __resetTossAdsForTest();
});

describe('resolveAdGroupId', () => {
  it('env 미설정 시 null (소스 하드코딩 폴백 없음)', () => {
    expect(resolveAdGroupId({ VITE_TOSS_AD_GROUP_ID: '' })).toBeNull();
    expect(resolveAdGroupId({ VITE_TOSS_AD_GROUP_ID: undefined })).toBeNull();
  });

  it('광고 그룹 ID 가 명시되면 그 값을 사용한다', () => {
    expect(resolveAdGroupId({ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' })).toBe('ad-prod-123');
  });
});

describe('isAdSlotAvailable', () => {
  it('지원 + 광고 그룹 ID 가 있으면 true', () => {
    h.setSupported(true);
    expect(isAdSlotAvailable({ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' })).toBe(true);
  });

  it('지원하지만 광고 그룹 ID 가 없으면 false (env 미설정 — 빈 래퍼 방지)', () => {
    h.setSupported(true);
    expect(isAdSlotAvailable({ VITE_TOSS_AD_GROUP_ID: '' })).toBe(false);
  });

  it('미지원 환경이면 false', () => {
    h.setSupported(false);
    expect(isAdSlotAvailable({ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' })).toBe(false);
  });

  it('initialize 미지원이면 attach 지원이어도 false', () => {
    h.setInitializeSupported(false);
    h.setAttachSupported(true);
    expect(isAdSlotAvailable({ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' })).toBe(false);
  });

  it('attachBanner 미지원이면 initialize 지원이어도 false', () => {
    h.setInitializeSupported(true);
    h.setAttachSupported(false);
    expect(isAdSlotAvailable({ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' })).toBe(false);
  });
});

describe('ensureTossAdsInitialized capability log', () => {
  it('미지원 환경에서도 capability 진단 로그를 1회 남긴다(버전·지원·광고ID 한눈에)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.setSupported(false);
    h.getTossAppVersion.mockReturnValue('5.206.0');

    ensureTossAdsInitialized();

    expect(warn).toHaveBeenCalledWith(
      '[ads] capability',
      expect.objectContaining({
        initSupported: false,
        attachSupported: false,
        tossAppVersion: '5.206.0',
        bannerApiMinVersion: '5.241.0',
      }),
    );
  });

  it('capability 로그는 여러 번 호출해도 1회만 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ensureTossAdsInitialized();
    ensureTossAdsInitialized();
    const calls = warn.mock.calls.filter(([msg]) => msg === '[ads] capability');
    expect(calls).toHaveLength(1);
  });

  it('getTossAppVersion 이 throw 해도 tossAppVersion=null 로 안전 처리한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.setSupported(false);
    h.getTossAppVersion.mockImplementation(() => {
      throw new Error('not in toss');
    });

    ensureTossAdsInitialized();

    expect(warn).toHaveBeenCalledWith(
      '[ads] capability',
      expect.objectContaining({ tossAppVersion: null }),
    );
  });
});

describe('AdBanner', () => {
  it('미지원 환경(isSupported=false)에서는 아무것도 렌더하지 않는다 (빈 화면 방지)', () => {
    h.setSupported(false);
    render(<AdBanner />);
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
    expect(h.attachBanner).not.toHaveBeenCalled();
  });

  it('initialize 미지원이면 아무것도 렌더하지 않고 초기화도 호출하지 않는다', () => {
    h.setInitializeSupported(false);
    h.setAttachSupported(true);
    render(<AdBanner />);
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
    expect(h.initialize).not.toHaveBeenCalled();
    expect(h.attachBanner).not.toHaveBeenCalled();
  });

  it('attachBanner 미지원이면 아무것도 렌더하지 않고 초기화도 호출하지 않는다', () => {
    h.setInitializeSupported(true);
    h.setAttachSupported(false);
    render(<AdBanner />);
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
    expect(h.initialize).not.toHaveBeenCalled();
    expect(h.attachBanner).not.toHaveBeenCalled();
  });

  it('지원 환경에서는 width 100% + 96px 컨테이너를 렌더하고 env 광고 ID 로 배너를 부착한다', () => {
    render(<AdBanner env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />);
    const container = screen.getByTestId('ad-banner');
    expect(container).toBeInTheDocument();
    expect(container.style.width).toBe('100%');
    expect(container.style.height).toBe('96px');
    expect(h.attachBanner).toHaveBeenCalledWith(
      'ad-prod-123',
      container,
      expect.objectContaining({
        variant: 'expanded',
        callbacks: expect.objectContaining({
          onNoFill: expect.any(Function),
          onAdFailedToRender: expect.any(Function),
        }),
      }),
    );
  });

  it('운영 env 광고 그룹 ID 를 attachBanner 에 그대로 전달한다', () => {
    render(
      <AdBanner
        env={{ VITE_TOSS_AD_GROUP_ID: 'ait.v2.live.a36156fd5d3c461d' }}
      />,
    );
    const container = screen.getByTestId('ad-banner');
    expect(h.attachBanner).toHaveBeenCalledWith(
      'ait.v2.live.a36156fd5d3c461d',
      container,
      expect.objectContaining({ variant: 'expanded' }),
    );
  });

  it('attachBanner 에 진단 콜백(onAdRendered/Impression/Viewable/Clicked)을 함께 전달한다', () => {
    render(<AdBanner env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />);
    expect(h.attachBanner).toHaveBeenCalledWith(
      'ad-prod-123',
      expect.anything(),
      expect.objectContaining({
        callbacks: expect.objectContaining({
          onAdRendered: expect.any(Function),
          onAdImpression: expect.any(Function),
          onAdViewable: expect.any(Function),
          onAdClicked: expect.any(Function),
        }),
      }),
    );
  });

  it('onAdRendered 발생 시 [ads] rendered 진단 로그를 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<AdBanner env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />);
    act(() => h.fireBannerEvent('onAdRendered'));
    expect(warn).toHaveBeenCalledWith(
      '[ads] rendered',
      expect.objectContaining({ slotId: 'slot-1', adGroupId: 'ad-prod-123' }),
    );
  });

  it('SDK 초기화는 앱 전역 1회만 수행하고, 여러 배너가 공유 ready 로 모두 부착된다 (F1 회귀 가드)', () => {
    // 최악 시나리오: SDK 가 첫 init 의 onInitialized 만 발화(fireOnlyFirstInit=true 기본).
    // 인스턴스별 init 이라면 2번째 배너는 attach 누락 → 이 테스트가 실패한다.
    render(
      <>
        <AdBanner env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />
        <AdBanner env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />
      </>,
    );
    // 싱글톤: 배너가 2개여도 initialize 는 정확히 1회.
    expect(h.initialize).toHaveBeenCalledTimes(1);
    // 공유 ready 로 두 배너 모두 부착.
    expect(h.attachBanner).toHaveBeenCalledTimes(2);
  });

  it('언마운트 시 배너를 destroy 한다', () => {
    const { unmount } = render(<AdBanner env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />);
    unmount();
    expect(h.destroy).toHaveBeenCalledTimes(1);
  });

  it('onNoFill 발생 시 배너와 부모 list item 을 숨기고 destroy 한다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <ul>
        <AdBannerListItem env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />
      </ul>,
    );

    expect(screen.getByRole('listitem', { name: '광고' })).toBeInTheDocument();

    act(() => {
      h.triggerNoFill();
    });

    await waitFor(() => {
      expect(screen.queryByRole('listitem', { name: '광고' })).not.toBeInTheDocument();
    });
    expect(h.destroy).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[ads] TossAds.attachBanner no fill',
      expect.objectContaining({ adGroupId: 'ad-prod-123' }),
    );
  });

  it('onAdFailedToRender 발생 시 배너와 부모 list item 을 숨기고 destroy 한다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ul>
        <AdBannerListItem env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />
      </ul>,
    );

    act(() => {
      h.triggerAdFailedToRender();
    });

    await waitFor(() => {
      expect(screen.queryByRole('listitem', { name: '광고' })).not.toBeInTheDocument();
    });
    expect(h.destroy).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      '[ads] TossAds.attachBanner render failed',
      expect.objectContaining({ adGroupId: 'ad-prod-123', code: 500 }),
    );
  });

  it('attachBanner 예외 시 빈 부모 list item 을 남기지 않는다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.setAttachThrows(true);

    render(
      <ul>
        <AdBannerListItem env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />
      </ul>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('listitem', { name: '광고' })).not.toBeInTheDocument();
    });
    expect(error).toHaveBeenCalledWith(
      '[ads] TossAds.attachBanner threw',
      expect.objectContaining({ adGroupId: 'ad-prod-123' }),
    );
  });
});

describe('AdBannerSlot (단독 보장 슬롯)', () => {
  it('지원 + 광고 ID 가 있으면 배너 컨테이너를 렌더한다(인연 수 무관 도달)', () => {
    render(<AdBannerSlot env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />);
    expect(screen.getByTestId('ad-banner')).toBeInTheDocument();
  });

  it('미지원 환경이면 아무것도 렌더하지 않는다(빈 공간 방지)', () => {
    h.setSupported(false);
    render(<AdBannerSlot env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />);
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
  });

  it('광고 ID 가 없으면 아무것도 렌더하지 않는다', () => {
    render(<AdBannerSlot env={{ VITE_TOSS_AD_GROUP_ID: '' }} />);
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
  });

  it('no-fill 발생 시 슬롯을 통째로 숨긴다(빈 컨테이너 잔존 없음)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<AdBannerSlot env={{ VITE_TOSS_AD_GROUP_ID: 'ad-prod-123' }} />);
    expect(screen.getByTestId('ad-banner')).toBeInTheDocument();
    act(() => {
      h.triggerNoFill();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
    });
  });
});
