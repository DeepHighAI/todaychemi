import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

const purchase = vi.hoisted(() => ({
  open: vi.fn(),
  clearError: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: api.apiFetch,
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

vi.mock('@/components/iap/use-feature-purchase', () => ({
  useFeaturePurchase: (options: { onSuccess?: (result: { unlocked: true }) => void }) => ({
    purchase: (info: unknown) => {
      purchase.open(info);
      void options.onSuccess?.({ unlocked: true });
    },
    isPurchasing: false,
    purchaseError: null,
    purchaseErrorMessage: null,
    clearError: purchase.clearError,
  }),
}));

import { renderWithProviders } from '@/test/render';
import { HapcardReplayButton } from './replay-button';

const DEFAULT_PROPS = {
  hapcardId: 'h1',
  relationId: 'rel-1',
  mode: '친구합',
  targetDate: '2026-06-22',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('HapcardReplayButton', () => {
  it('부적 부족 preflight → replay POST 없이 즉시 결제 안내를 보여준다', async () => {
    const user = userEvent.setup();
    api.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/hapcards/h1/replay/preflight') {
        return {
          mode: 'pay_required',
          payment: { feature: 'replay', ref: 'replay:h1:2026-06-22', amount_krw: 440 },
        };
      }
      throw new Error(`unexpected api call: ${path}`);
    });

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: '케미 다시 맞추기' }));

    expect(await screen.findByText('케미 다시 맞추기는 ₩440이 필요해요.')).toBeInTheDocument();
    expect(screen.queryByText('처리 중…')).not.toBeInTheDocument();
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
    expect(api.apiFetch).toHaveBeenCalledWith('/api/hapcards/h1/replay/preflight', {
      method: 'GET',
      token: 'test-token',
    });
  });

  it('결제 안내에서 동의 후 결제를 누르면 preflight ref 로 IAP를 연다', async () => {
    const user = userEvent.setup();
    api.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/hapcards/h1/replay/preflight') {
        return {
          mode: 'pay_required',
          payment: { feature: 'replay', ref: 'replay:h1:2026-06-22', amount_krw: 440 },
        };
      }
      return { hapcard_id: 'h1' };
    });

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: '케미 다시 맞추기' }));
    await screen.findByText('케미 다시 맞추기는 ₩440이 필요해요.');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '₩440 결제하기' }));

    expect(purchase.open).toHaveBeenCalledWith({
      feature: 'replay',
      ref: 'replay:h1:2026-06-22',
      amount_krw: 440,
    });
  });

  it('사용 가능한 부적이 있으면 즉시 replay POST 로 넘어가고 분석 중 안내를 보여준다', async () => {
    const user = userEvent.setup();
    let replayResolve!: (value: unknown) => void;
    api.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/hapcards/h1/replay/preflight') {
        return Promise.resolve({ mode: 'ready', payment: null });
      }
      if (path === '/api/hapcards/h1/replay') {
        return new Promise((resolve) => {
          replayResolve = resolve;
        });
      }
      return Promise.reject(new Error(`unexpected api call: ${path}`));
    });

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: '케미 다시 맞추기' }));

    expect(await screen.findByText(/부적을 사용해 분석 중이에요/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
    expect(api.apiFetch).toHaveBeenCalledWith('/api/hapcards/h1/replay', {
      method: 'POST',
      token: 'test-token',
    });

    replayResolve({ hapcard_id: 'h1' });
  });

  it('preflight 확인 중에는 닫기 버튼을 노출하지 않는다', async () => {
    const user = userEvent.setup();
    api.apiFetch.mockImplementation((path: string) => {
      if (path === '/api/hapcards/h1/replay/preflight') {
        return new Promise(() => {});
      }
      return Promise.reject(new Error(`unexpected api call: ${path}`));
    });

    renderWithProviders(<HapcardReplayButton {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: '케미 다시 맞추기' }));

    await waitFor(() => {
      expect(screen.getByText(/부적을 확인하고 있어요/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });
});
