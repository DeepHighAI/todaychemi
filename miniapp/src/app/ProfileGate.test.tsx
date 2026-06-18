import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ token: 'tok' }) }));
vi.mock('@/lib/me/use-me-chart', () => ({ useMeChart: vi.fn() }));

import { useMeChart } from '@/lib/me/use-me-chart';
import { ProfileGate } from './ProfileGate';

const mockUseMeChart = vi.mocked(useMeChart);

function renderGate() {
  const router = createMemoryRouter(
    [
      {
        element: <ProfileGate />,
        children: [{ index: true, element: <div>HOME_STUB</div> }],
      },
      { path: '/onboarding', element: <div>ONBOARDING_STUB</div> },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProfileGate', () => {
  it('로딩 중 → LoadingState (게이트 보류, 자식·리다이렉트 모두 미발생)', () => {
    mockUseMeChart.mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
    renderGate();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.queryByText('HOME_STUB')).not.toBeInTheDocument();
    expect(screen.queryByText('ONBOARDING_STUB')).not.toBeInTheDocument();
  });

  it('확정 미등록(chart=null) → /onboarding 으로 이동', () => {
    mockUseMeChart.mockReturnValue({ data: null, isLoading: false, isError: false } as never);
    renderGate();
    expect(screen.getByText('ONBOARDING_STUB')).toBeInTheDocument();
    expect(screen.queryByText('HOME_STUB')).not.toBeInTheDocument();
  });

  it('chart 있음 → 자식(Outlet) 렌더', () => {
    mockUseMeChart.mockReturnValue({
      data: { day_pillar: '甲子' },
      isLoading: false,
      isError: false,
    } as never);
    renderGate();
    expect(screen.getByText('HOME_STUB')).toBeInTheDocument();
    expect(screen.queryByText('ONBOARDING_STUB')).not.toBeInTheDocument();
  });

  it('조회 실패(isError) → fail-open 으로 자식(Outlet) 통과', () => {
    mockUseMeChart.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never);
    renderGate();
    expect(screen.getByText('HOME_STUB')).toBeInTheDocument();
    expect(screen.queryByText('ONBOARDING_STUB')).not.toBeInTheDocument();
  });
});
