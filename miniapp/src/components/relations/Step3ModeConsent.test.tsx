import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
const { mockInvalidate, mockGetQueriesData } = vi.hoisted(() => ({
  mockInvalidate: vi.fn().mockResolvedValue(undefined),
  mockGetQueriesData: vi.fn(),
}));
const purchaseMock = vi.hoisted(() => ({
  open: vi.fn(),
  clearError: vi.fn(),
  nextResult: {
    unlocked: true,
    delivery: { feature: 'relation_slot' as const, relation_id: 'rel-delivered-001' },
  },
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'tok' }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidate,
      getQueriesData: mockGetQueriesData,
    }),
  };
});

vi.mock('@/components/iap/use-feature-purchase', () => ({
  useFeaturePurchase: (options: { onSuccess?: (result: typeof purchaseMock.nextResult) => void }) => ({
    purchase: (info: unknown) => {
      purchaseMock.open(info);
      void options.onSuccess?.(purchaseMock.nextResult);
    },
    isPurchasing: false,
    purchaseError: null,
    purchaseErrorMessage: null,
    clearError: purchaseMock.clearError,
  }),
}));

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { Step3ModeConsent } from './Step3ModeConsent';
import { apiFetch, ApiError } from '@/lib/api/client';

const mockApiFetch = vi.mocked(apiFetch);

const CREATE_BODY = {
  nickname: '봄달',
  gender: 'F' as const,
  birth_date: '1995-07-20',
  birth_date_calendar: 'solar' as const,
  is_lunar_leap: false,
  birth_time_knowledge: 'exact' as const,
  birth_time: '09:00',
  birth_longitude: null,
  is_primary: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQueriesData.mockReturnValue([[['feed'], [{ relation_id: 'r1' }, { relation_id: 'r2' }]]]);
  purchaseMock.nextResult = {
    unlocked: true,
    delivery: { feature: 'relation_slot', relation_id: 'rel-delivered-001' },
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Step3ModeConsent — relation_slot IAP delivery', () => {
  it('결제 성공 delivery 를 받으면 재제출 없이 /feed/:relationId 로 replace 이동한다', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockApiFetch.mockRejectedValueOnce(
      new ApiError(402, 'PAYMENT_REQUIRED', 'payment required', {
        feature: 'relation_slot',
        ref: 'relation_slot:pending-001',
        amount_krw: 550,
      }),
    );

    renderWithProviders(
      <Step3ModeConsent
        createBody={CREATE_BODY}
        initialMode="친구합"
        initialConsent={true}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole('button', { name: '등록하기' }));
    expect(await screen.findByText('이 인연을 등록하려면 결제가 필요해요.')).toBeInTheDocument();

    const paywallConsent = screen.getAllByRole('checkbox').at(-1);
    expect(paywallConsent).toBeDefined();
    await user.click(paywallConsent!);
    await user.click(screen.getByRole('button', { name: '₩550 결제하기' }));

    expect(purchaseMock.open).toHaveBeenCalledWith({
      feature: 'relation_slot',
      ref: 'relation_slot:pending-001',
      amount_krw: 550,
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/feed/rel-delivered-001', { replace: true });
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['feed'] });
    expect(mockInvalidate).toHaveBeenCalledWith({
      queryKey: ['relation-detail', 'rel-delivered-001'],
    });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['today'] });
  });
});
