// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../../../utils/render-with-providers';
import HapcardView from '@/app/(app)/hapcard/[id]/HapcardView';

const mockFetch = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'hap-1' }),
  useSearchParams: () => new URLSearchParams({ mode: '일합' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HapcardView 402 결제 처리', () => {
  it('PAYMENT_REQUIRED(402) → 결제 시트 렌더, generic 에러 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
        feature: 'hapcard',
        ref: 'cache-abc',
        amount_krw: 800,
      }),
    });

    renderWithProviders(<HapcardView />);

    expect(await screen.findByTestId('feature-pay-sheet')).toBeInTheDocument();
    expect(
      screen.queryByText('오늘 우리는을 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeNull();
  });

  it('인연 차트 준비 중(RELATION_CHART_NOT_FOUND) → 차트 준비 안내, 결제 시트 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'RELATION_CHART_NOT_FOUND' } }),
    });

    renderWithProviders(<HapcardView />);

    expect(await screen.findByText('오늘 우리는 준비 중')).toBeInTheDocument();
    expect(screen.queryByTestId('feature-pay-sheet')).toBeNull();
  });

  it('일반 에러(INTERNAL_ERROR) → generic 안내, 결제 시트 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR' } }),
    });

    renderWithProviders(<HapcardView />);

    expect(
      await screen.findByText('오늘 우리는을 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('feature-pay-sheet')).toBeNull();
  });
});
