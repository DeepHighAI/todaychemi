import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === '/api/whatif/work/preflight') {
      return {
        mode: 'pay_required',
        feature: 'whatif',
        ref: 'whatif-cache-key',
        token_cost: 9,
        amount_krw: 440,
        balance: 8,
        shortage: 1,
        payment: { feature: 'whatif', ref: 'whatif-cache-key', amount_krw: 440 },
      };
    }
    throw new Error(`unexpected api call: ${path}`);
  }),
}));

const purchase = vi.hoisted(() => ({
  open: vi.fn(),
  clearError: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: api.apiFetch,
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
      public readonly payment?: unknown,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

vi.mock('@/components/iap/use-feature-purchase', () => ({
  useFeaturePurchase: () => ({
    purchase: purchase.open,
    isPurchasing: false,
    purchaseError: null,
    purchaseErrorMessage: null,
    clearError: purchase.clearError,
  }),
}));

import { renderWithProviders } from '@/test/render';
import { WhatifPage } from './WhatifPage';

afterEach(() => {
  vi.clearAllMocks();
});

describe('WhatifPage', () => {
  it('PAYMENT_REQUIRED 페이월 닫기 시 에러 카드로 전환하지 않고 이전 화면으로 돌아간다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/" element={<p>HOME_SCREEN</p>} />
        <Route path="/whatif/:type" element={<WhatifPage />} />
      </Routes>,
      { routerEntries: ['/', '/whatif/work'] },
    );

    expect(await screen.findByTestId('whatif-pay-required')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(await screen.findByText('HOME_SCREEN')).toBeInTheDocument();
    expect(screen.queryByTestId('error-card')).not.toBeInTheDocument();
    expect(purchase.clearError).toHaveBeenCalledTimes(1);
  });
});
