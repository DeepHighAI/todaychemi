import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  let loadSupported = true;
  let showSupported = true;
  let loadThrows = false;
  let showThrows = false;
  let loadHandler: ((event: { type: 'loaded' }) => void) | undefined;
  let showHandler:
    | ((event:
        | { type: 'requested' }
        | { type: 'clicked' }
        | { type: 'dismissed' }
        | { type: 'failedToShow' }
        | { type: 'impression' }
        | { type: 'show' }
        | { type: 'userEarnedReward'; data: { unitType: string; unitAmount: number } }
      ) => void)
    | undefined;
  const loadCleanup = vi.fn();
  const showCleanup = vi.fn();
  const loadFullScreenAd = vi.fn((params: {
    options: { adGroupId: string };
    onEvent: (event: { type: 'loaded' }) => void;
    onError: (error: unknown) => void;
  }) => {
    if (loadThrows) throw new Error('load failed');
    loadHandler = params.onEvent;
    return loadCleanup;
  });
  const showFullScreenAd = vi.fn((params: {
    options: { adGroupId: string };
    onEvent: NonNullable<typeof showHandler>;
    onError: (error: unknown) => void;
  }) => {
    if (showThrows) throw new Error('show failed');
    showHandler = params.onEvent;
    return showCleanup;
  });
  (loadFullScreenAd as unknown as { isSupported: () => boolean }).isSupported = () => loadSupported;
  (showFullScreenAd as unknown as { isSupported: () => boolean }).isSupported = () => showSupported;

  return {
    loadFullScreenAd,
    showFullScreenAd,
    loadCleanup,
    showCleanup,
    setSupported: (load: boolean, show = load) => {
      loadSupported = load;
      showSupported = show;
    },
    setThrows: (load: boolean, show = false) => {
      loadThrows = load;
      showThrows = show;
    },
    triggerLoaded: () => loadHandler?.({ type: 'loaded' }),
    triggerShowEvent: (event: Parameters<NonNullable<typeof showHandler>>[0]) => showHandler?.(event),
    reset: () => {
      loadSupported = true;
      showSupported = true;
      loadThrows = false;
      showThrows = false;
      loadHandler = undefined;
      showHandler = undefined;
      loadCleanup.mockClear();
      showCleanup.mockClear();
    },
  };
});

const api = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  loadFullScreenAd: h.loadFullScreenAd,
  showFullScreenAd: h.showFullScreenAd,
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: api.apiFetch,
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'tok' }),
}));

import { renderWithProviders } from '@/test/render';
import {
  isRewardedAdAvailable,
  resolveRewardedAdGroupId,
  RewardedAdCard,
} from './rewarded-ad';

beforeEach(() => {
  vi.clearAllMocks();
  h.reset();
  api.apiFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path !== '/api/rewards/ad') return {};
    if (options?.method === 'POST') {
      return {
        ok: true,
        reward: {
          awarded: true,
          reason: 'AWARDED',
          amount_awarded: 10,
          balance_after: 20,
          remaining: 2,
        },
      };
    }
    return {
      ok: true,
      reward: {
        amount_awarded: 10,
        daily_cap: 3,
        awarded_today: 1,
        remaining: 2,
      },
    };
  });
});

describe('resolveRewardedAdGroupId', () => {
  it('env 미설정 시 null (소스 하드코딩 폴백 없음)', () => {
    expect(resolveRewardedAdGroupId({ VITE_TOSS_REWARDED_AD_GROUP_ID: '' })).toBeNull();
    expect(resolveRewardedAdGroupId({ VITE_TOSS_REWARDED_AD_GROUP_ID: undefined })).toBeNull();
  });

  it('운영 광고 그룹 ID 가 있으면 그대로 사용한다', () => {
    expect(resolveRewardedAdGroupId({
      VITE_TOSS_REWARDED_AD_GROUP_ID: 'ait.v2.live.234c1a1d08ee4ce3',
    })).toBe('ait.v2.live.234c1a1d08ee4ce3');
  });
});

describe('isRewardedAdAvailable', () => {
  it('load/show 모두 지원되고 광고 그룹 ID 가 있으면 true', () => {
    h.setSupported(true);
    expect(isRewardedAdAvailable({ VITE_TOSS_REWARDED_AD_GROUP_ID: 'ad-prod' })).toBe(true);
  });

  it('showFullScreenAd 미지원이면 false', () => {
    h.setSupported(true, false);
    expect(isRewardedAdAvailable({
      VITE_TOSS_REWARDED_AD_GROUP_ID: 'ad-prod',
    })).toBe(false);
  });

  it('광고 그룹 ID 가 없으면 false', () => {
    h.setSupported(true);
    expect(isRewardedAdAvailable({ VITE_TOSS_REWARDED_AD_GROUP_ID: '' })).toBe(false);
  });
});

describe('RewardedAdCard', () => {
  it('프로덕션 광고 그룹 ID 가 없으면 CTA 를 렌더하지 않는다', () => {
    renderWithProviders(
      <RewardedAdCard env={{ VITE_TOSS_REWARDED_AD_GROUP_ID: '' }} />,
    );

    expect(screen.queryByRole('button', { name: /광고 보고 부적 10개 받기/ })).not.toBeInTheDocument();
    expect(h.loadFullScreenAd).not.toHaveBeenCalled();
  });

  it('진입 시 광고를 미리 load 하고 loaded 이후 버튼으로 show 한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RewardedAdCard env={{ VITE_TOSS_REWARDED_AD_GROUP_ID: 'ad-prod' }} />);

    const button = await screen.findByRole('button', { name: /광고 보고 부적 10개 받기/ });
    await waitFor(() => {
      expect(h.loadFullScreenAd).toHaveBeenCalledWith(expect.objectContaining({
        options: { adGroupId: 'ad-prod' },
      }));
    });
    expect(button).toBeDisabled();

    act(() => h.triggerLoaded());
    expect(button).not.toBeDisabled();

    await user.click(button);

    expect(h.showFullScreenAd).toHaveBeenCalledWith(expect.objectContaining({
      options: { adGroupId: 'ad-prod' },
    }));
  });

  it('dismissed/clicked/impression 만으로는 보상 API 를 호출하지 않는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RewardedAdCard env={{ VITE_TOSS_REWARDED_AD_GROUP_ID: 'ad-prod' }} />);

    const button = await screen.findByRole('button', { name: /광고 보고 부적 10개 받기/ });
    await waitFor(() => expect(h.loadFullScreenAd).toHaveBeenCalled());
    act(() => h.triggerLoaded());
    await user.click(button);

    act(() => h.triggerShowEvent({ type: 'clicked' }));
    act(() => h.triggerShowEvent({ type: 'impression' }));
    act(() => h.triggerShowEvent({ type: 'dismissed' }));

    const postCalls = api.apiFetch.mock.calls.filter((call) => call[1]?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });

  it('userEarnedReward 이벤트에서만 서버 보상 지급을 요청한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RewardedAdCard env={{ VITE_TOSS_REWARDED_AD_GROUP_ID: 'ad-prod' }} />);

    const button = await screen.findByRole('button', { name: /광고 보고 부적 10개 받기/ });
    await waitFor(() => expect(h.loadFullScreenAd).toHaveBeenCalled());
    act(() => h.triggerLoaded());
    await user.click(button);

    act(() => h.triggerShowEvent({
      type: 'userEarnedReward',
      data: { unitType: '부적', unitAmount: 10 },
    }));

    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith('/api/rewards/ad', {
        method: 'POST',
        token: 'tok',
      });
    });
    expect(await screen.findByText('부적 10개를 받았어요')).toBeInTheDocument();
  });

  it('일 한도 소진 시 버튼은 비활성화하고 광고를 load 하지 않는다', async () => {
    api.apiFetch.mockImplementation(async (path: string) => {
      if (path !== '/api/rewards/ad') return {};
      return {
        ok: true,
        reward: {
          amount_awarded: 10,
          daily_cap: 3,
          awarded_today: 3,
          remaining: 0,
        },
      };
    });

    renderWithProviders(<RewardedAdCard env={{ VITE_TOSS_REWARDED_AD_GROUP_ID: 'ad-prod' }} />);

    const button = await screen.findByRole('button', { name: /광고 보고 부적 10개 받기/ });
    expect(button).toBeDisabled();
    expect(await screen.findByText('오늘 0번 남았어요')).toBeInTheDocument();
    expect(h.loadFullScreenAd).not.toHaveBeenCalled();
  });
});
