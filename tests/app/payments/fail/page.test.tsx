// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/payments/complete');

import PaymentsFailPage from '@/app/payments/fail/page';
import { markPaymentFailedForUser } from '@/lib/payments/complete';
import { createClient } from '@/lib/supabase/server';

const USER_ID = 'user-payment-001';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
  } as never);
});

describe('/payments/fail page', () => {
  it('실패 정보를 표시하고 재시도 CTA를 충전 페이지로 연결한다', async () => {
    render(await PaymentsFailPage({
      searchParams: Promise.resolve({
        orderId: 'twoday_1_abcd12',
        code: 'USER_CANCEL',
        message: '사용자가 결제를 취소했습니다.',
      }),
    }));

    expect(screen.getByText('USER_CANCEL')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다시 충전' })).toHaveAttribute('href', '/payments/charge');
    expect(markPaymentFailedForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      orderId: 'twoday_1_abcd12',
      code: 'USER_CANCEL',
      message: '사용자가 결제를 취소했습니다.',
    });
  });

  it('실패 화면에서는 confirm API 경로를 호출하지 않는다', async () => {
    render(await PaymentsFailPage({
      searchParams: Promise.resolve({
        orderId: 'twoday_1_abcd12',
        code: 'USER_CANCEL',
        message: '사용자가 결제를 취소했습니다.',
      }),
    }));

    expect(markPaymentFailedForUser).toHaveBeenCalledOnce();
  });
});
