// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';

const { guestReadyMock, replaceMock } = vi.hoisted(() => ({
  guestReadyMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock('@/lib/guest/session', () => ({
  hasGuestLegalConsentReady: guestReadyMock,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

import { OnboardingAccessGuard } from '@/components/onboarding/onboarding-access-guard';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OnboardingAccessGuard', () => {
  it('게스트 동의가 준비되면 fetch 없이 자식을 렌더한다', async () => {
    guestReadyMock.mockReturnValue(true);
    global.fetch = vi.fn();

    renderWithIntl(
      <OnboardingAccessGuard>
        <div>온보딩 내용</div>
      </OnboardingAccessGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText('온보딩 내용')).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('게스트 아님 + /api/me 200이면 자식을 렌더한다', async () => {
    guestReadyMock.mockReturnValue(false);
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    renderWithIntl(
      <OnboardingAccessGuard>
        <div>온보딩 내용</div>
      </OnboardingAccessGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText('온보딩 내용')).toBeInTheDocument();
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('게스트 아님 + /api/me 401이면 /start로 리다이렉트한다', async () => {
    guestReadyMock.mockReturnValue(false);
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));

    renderWithIntl(
      <OnboardingAccessGuard>
        <div>온보딩 내용</div>
      </OnboardingAccessGuard>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/start');
    });
    expect(screen.queryByText('온보딩 내용')).not.toBeInTheDocument();
  });

  it('fetch 실패 시 /start로 리다이렉트한다', async () => {
    guestReadyMock.mockReturnValue(false);
    global.fetch = vi.fn().mockRejectedValue(new Error('network'));

    renderWithIntl(
      <OnboardingAccessGuard>
        <div>온보딩 내용</div>
      </OnboardingAccessGuard>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/start');
    });
  });
});
