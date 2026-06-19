import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

// Apps-in-Toss SDK 는 모듈 그래프(toss-share·iap/purchase)에서 import 되므로 no-op 모킹.
vi.mock('@apps-in-toss/web-framework', () => ({
  getTossShareLink: vi.fn(),
  share: vi.fn(),
  appLogin: vi.fn(),
  openURL: vi.fn(),
  Storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
  IAP: {
    createOneTimePurchaseOrder: vi.fn(),
    getPendingOrders: vi.fn(),
    completeProductGrant: vi.fn(),
    getCompletedOrRefundedOrders: vi.fn(),
    getProductItemList: vi.fn(),
  },
}));

// useAuth 는 토큰만 제공하면 충분 (AuthProvider 비동기 복원 우회).
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    token: 'test-token',
    isAuthed: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { renderWithProviders } from '@/test/render';
import { HapcardPage } from './HapcardPage';

function mockFetch402() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: () =>
        Promise.resolve({
          // 서버 실제 응답 형태 — 오픈 할인가(amount_krw=500) 그대로.
          error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
          feature: 'hapcard',
          ref: 'cache-key-abc',
          amount_krw: 550,
        }),
    } as Response),
  );
}

beforeEach(() => {
  mockFetch402();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('HapcardPage 402 결제 흐름', () => {
  it('402 응답 시 청약철회 동의 후 결제 버튼이 활성화된다 (payInfo 가 채워져야 함)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/hapcard/:id" element={<HapcardPage />} />
      </Routes>,
      { routerEntries: ['/hapcard/abc?mode=일합'] },
    );

    // 결제 안내 페이월 노출 — 청약철회 동의 체크박스로 게이트(가격 문자열 비의존).
    await screen.findByRole('checkbox');

    // 고지가는 서버 제공 실청구액(오픈 할인가 ₩500)을 표시해야 한다 — 하드코딩 ₩1,000 아님.
    expect(screen.getByText(/₩550이 필요해요/)).toBeInTheDocument();

    const payButton = screen.getByRole('button', { name: /결제하기/ });
    // 동의 전: 비활성
    expect(payButton).toBeDisabled();

    // 청약철회 제한 동의 체크
    await user.click(screen.getByRole('checkbox'));

    // 동의 후: payInfo 가 채워졌다면 활성화. (버그 시 payInfo=undefined 라 계속 비활성 → 실패)
    expect(payButton).not.toBeDisabled();
  });
});
