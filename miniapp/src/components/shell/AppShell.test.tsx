import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';

const sdk = vi.hoisted(() => ({
  listeners: {} as Record<string, { onEvent: () => void; onError?: (error: Error) => void }>,
  addEventListener: vi.fn((event: string, handler: { onEvent: () => void; onError?: (error: Error) => void }) => {
    sdk.listeners[event] = handler;
    return vi.fn();
  }),
}));

const closeView = vi.hoisted(() => ({
  closeMiniappView: vi.fn(() => Promise.resolve()),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  getDeviceId: vi.fn(() => 'device-1'),
  graniteEvent: {
    addEventListener: sdk.addEventListener,
  },
}));

vi.mock('@/lib/navigation/close-view', () => ({
  closeMiniappView: closeView.closeMiniappView,
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'tok', isAuthed: false }),
}));

vi.mock('@/lib/iap/purchase', () => ({
  restorePendingOrders: vi.fn(),
}));

vi.mock('@/components/rewards/reward-gate', () => ({
  RewardGate: () => null,
}));

import { renderWithProviders } from '@/test/render';
import { AppShell } from './AppShell';

function ShellRoutes() {
  return (
    <Routes>
      <Route element={<AppShell showNav={false} />}>
        <Route
          path="/"
          element={(
            <div>
              <p>HOME_STUB</p>
              <Link to="/feed">피드로 이동</Link>
            </div>
          )}
        />
        <Route path="/feed" element={<p>FEED_STUB</p>} />
      </Route>
    </Routes>
  );
}

afterEach(() => {
  sdk.listeners = {};
  vi.clearAllMocks();
});

describe('AppShell native navigation events', () => {
  it('앱 내부 스택이 없으면 backEvent 에서 closeView 를 호출한다', async () => {
    renderWithProviders(<ShellRoutes />);

    await act(async () => {
      sdk.listeners.backEvent.onEvent();
    });

    expect(closeView.closeMiniappView).toHaveBeenCalledTimes(1);
  });

  it('앱 내부 스택이 있으면 backEvent 에서 라우터 뒤로가기를 수행한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShellRoutes />);

    await user.click(screen.getByRole('link', { name: '피드로 이동' }));
    expect(await screen.findByText('FEED_STUB')).toBeInTheDocument();

    await act(async () => {
      sdk.listeners.backEvent.onEvent();
    });

    expect(await screen.findByText('HOME_STUB')).toBeInTheDocument();
    expect(closeView.closeMiniappView).not.toHaveBeenCalled();
  });

  it('homeEvent 는 서비스 진입점으로 이동한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShellRoutes />);

    await user.click(screen.getByRole('link', { name: '피드로 이동' }));
    expect(await screen.findByText('FEED_STUB')).toBeInTheDocument();

    act(() => {
      sdk.listeners.homeEvent.onEvent();
    });

    expect(await screen.findByText('HOME_STUB')).toBeInTheDocument();

    await act(async () => {
      sdk.listeners.backEvent.onEvent();
    });

    expect(closeView.closeMiniappView).toHaveBeenCalledTimes(1);
  });
});
