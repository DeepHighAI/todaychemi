import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  listeners: {} as Record<string, { onEvent: () => void; onError?: (error: Error) => void }>,
  addEventListener: vi.fn((event: string, handler: { onEvent: () => void; onError?: (error: Error) => void }) => {
    sdk.listeners[event] = handler;
    return vi.fn(() => {
      if (sdk.listeners[event] === handler) {
        delete sdk.listeners[event];
      }
    });
  }),
}));

const closeView = vi.hoisted(() => ({
  closeMiniappView: vi.fn(() => Promise.resolve()),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  getDeviceId: vi.fn(() => 'device-1'),
  getSchemeUri: vi.fn(() => null),
  graniteEvent: {
    addEventListener: sdk.addEventListener,
  },
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'tok', isAuthed: false }),
}));

vi.mock('@/lib/iap/purchase', () => ({
  restorePendingOrders: vi.fn(),
}));

vi.mock('@/lib/navigation/close-view', () => ({
  closeMiniappView: closeView.closeMiniappView,
}));

vi.mock('@/components/rewards/reward-gate', () => ({
  RewardGate: () => null,
}));

vi.mock('./ProfileGate', async () => {
  const { Outlet } = await import('react-router-dom');
  return { ProfileGate: () => <Outlet /> };
});

vi.mock('./pages/HomePage', async () => {
  const { Link } = await import('react-router-dom');
  return {
    HomePage: () => (
      <div>
        <p>HOME_STUB</p>
        <Link to="/hapcard/hap-1?mode=일합">케미카드로 이동</Link>
      </div>
    ),
  };
});

vi.mock('./pages/HapcardPage', () => ({
  HapcardPage: () => <p>HAPCARD_STUB</p>,
}));

vi.mock('./pages/FeedPage', () => ({
  FeedPage: () => <p>FEED_STUB</p>,
}));

vi.mock('./pages/MePage', () => ({
  MePage: () => <p>ME_STUB</p>,
}));

vi.mock('./pages/OnboardingPage', () => ({
  OnboardingPage: () => <p>ONBOARDING_STUB</p>,
}));

vi.mock('./pages/RelationDetailPage', () => ({
  RelationDetailPage: () => <p>RELATION_DETAIL_STUB</p>,
}));

vi.mock('./pages/RelationsNewPage', () => ({
  RelationsNewPage: () => <p>RELATIONS_NEW_STUB</p>,
}));

vi.mock('./pages/WhatifPage', () => ({
  WhatifPage: () => <p>WHATIF_STUB</p>,
}));

vi.mock('./pages/LegalPage', () => ({
  LegalPage: () => <p>LEGAL_STUB</p>,
}));

import { AppRouter } from './routes';

function renderAppRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  sdk.listeners = {};
  vi.clearAllMocks();
});

describe('AppRouter shell layout', () => {
  it('메인 라우트에서 standalone 라우트로 이동해도 AppShell back stack 을 보존한다', async () => {
    const user = userEvent.setup();
    renderAppRouter();

    await user.click(screen.getByRole('link', { name: '케미카드로 이동' }));
    expect(await screen.findByText('HAPCARD_STUB')).toBeInTheDocument();

    await act(async () => {
      sdk.listeners.backEvent.onEvent();
    });

    expect(await screen.findByText('HOME_STUB')).toBeInTheDocument();
    expect(closeView.closeMiniappView).not.toHaveBeenCalled();
  });
});
