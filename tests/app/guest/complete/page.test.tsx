// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/components/feedback/LoadingState', () => ({
  LoadingState: () => <div data-testid="loading-state" />,
}));

const mockReplace = vi.fn();
const mockFetch = vi.fn();

const GUEST_ONBOARDING = {
  nickname: '하늘달',
  birth_date: '1995-11-05',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '14:20',
  gender: 'M',
};

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.stubGlobal('fetch', mockFetch);
});

async function renderGuestCompletePage() {
  const { default: GuestCompletePage } = await import('@/app/guest/complete/page');
  return render(<GuestCompletePage />);
}

describe('/guest/complete', () => {
  it('returns to /start when guest onboarding data is missing', async () => {
    await renderGuestCompletePage();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/start'));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('stores guest onboarding on the authenticated account and clears guest storage', async () => {
    window.sessionStorage.setItem('osa_guest_legal_ready', '1');
    window.sessionStorage.setItem('osa_guest_onboarding', JSON.stringify(GUEST_ONBOARDING));
    window.sessionStorage.setItem('osa_guest_today', JSON.stringify({ card: { headline: 'x' } }));
    mockFetch.mockResolvedValue({ ok: true, status: 201 });

    await renderGuestCompletePage();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/onboarding', expect.any(Object)));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual(GUEST_ONBOARDING);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/relations/new'));
    expect(window.sessionStorage.getItem('osa_guest_legal_ready')).toBeNull();
    expect(window.sessionStorage.getItem('osa_guest_onboarding')).toBeNull();
    expect(window.sessionStorage.getItem('osa_guest_today')).toBeNull();
  });

  it('sends unauthenticated users back through login with the guest completion next path', async () => {
    window.sessionStorage.setItem('osa_guest_onboarding', JSON.stringify(GUEST_ONBOARDING));
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await renderGuestCompletePage();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login?next=/guest/complete'));
  });

  it('shows a retry message for unexpected migration errors', async () => {
    window.sessionStorage.setItem('osa_guest_onboarding', JSON.stringify(GUEST_ONBOARDING));
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await act(async () => {
      await renderGuestCompletePage();
    });

    await screen.findByText('이어받기 실패');
    expect(screen.getByRole('link', { name: '처음부터 다시 시작' })).toHaveAttribute(
      'href',
      '/start',
    );
  });
});
