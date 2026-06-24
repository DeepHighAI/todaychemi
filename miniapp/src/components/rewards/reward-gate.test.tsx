import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';

vi.mock('@/lib/api/client');
vi.mock('@/lib/auth/AuthProvider');

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { RewardGate } from './reward-gate';
import { RewardNoticeHost } from './reward-notice-host';
import { clearRewardNotice } from './reward-notice-store';

const authed = { token: 'tok', isAuthed: true, isLoading: false, login: vi.fn(), logout: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  clearRewardNotice();
  vi.mocked(useAuth).mockReturnValue(authed as never);
});

describe('RewardGate', () => {
  it('가입 보상 지급 시 화면을 막지 않는 보상 안내를 노출한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      reward: { awarded: true, reason: 'AWARDED', signup_awarded: true, daily_login_awarded: true, amount_awarded: 55 },
    } as never);

    renderWithProviders(
      <>
        <RewardGate />
        <RewardNoticeHost />
      </>,
      { routerEntries: ['/'] },
    );

    expect(await screen.findByRole('status')).toHaveTextContent('+55');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/api/rewards/session', { method: 'POST', token: 'tok' });
  });

  it('이미 지급된 세션(ALREADY_AWARDED)에서는 팝업을 노출하지 않는다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      reward: { awarded: false, reason: 'ALREADY_AWARDED', signup_awarded: false, daily_login_awarded: false, amount_awarded: 0 },
    } as never);

    renderWithProviders(<RewardGate />, { routerEntries: ['/'] });

    // 비동기 응답 처리 시간을 준 뒤 팝업이 없음을 확인
    await Promise.resolve();
    expect(screen.queryByText(/부적/)).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('온보딩 경로에서는 보상 RPC 를 호출하지 않는다', () => {
    renderWithProviders(<RewardGate />, { routerEntries: ['/onboarding'] });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('비인증 상태에서는 보상 RPC 를 호출하지 않는다', () => {
    vi.mocked(useAuth).mockReturnValue({ ...authed, isAuthed: false } as never);
    renderWithProviders(<RewardGate />, { routerEntries: ['/'] });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
