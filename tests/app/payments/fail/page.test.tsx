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
  it('실패 정보를 표시하고 재시도 CTA를 케미피드로 연결한다', async () => {
    render(await PaymentsFailPage({
      searchParams: Promise.resolve({
        orderId: 'twoday_1_abcd12',
        code: 'USER_CANCEL',
        message: '사용자가 결제를 취소했습니다.',
      }),
    }));

    expect(screen.getByText('USER_CANCEL')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '케미피드로' })).toHaveAttribute('href', '/feed');
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

  it('실패 기록 side effect 가 실패해도 실패 화면은 렌더한다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(markPaymentFailedForUser).mockRejectedValueOnce(new Error('db unavailable'));

    render(await PaymentsFailPage({
      searchParams: Promise.resolve({
        orderId: 'twoday_1_abcd12',
        code: 'USER_CANCEL',
        message: '사용자가 결제를 취소했습니다.',
      }),
    }));

    expect(screen.getByText('USER_CANCEL')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '케미피드로' })).toHaveAttribute('href', '/feed');
    expect(consoleSpy).toHaveBeenCalledWith(
      'payment_fail_mark_failed',
      expect.objectContaining({
        order_id: 'twoday_1_abcd12',
        code: 'USER_CANCEL',
      }),
    );
    consoleSpy.mockRestore();
  });

  it('실패 기록 side effect 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(markPaymentFailedForUser).mockRejectedValueOnce(
      new Error('db failed birth_date=1991-03-15 birth_time=14:30 gender=F'),
    );

    render(await PaymentsFailPage({
      searchParams: Promise.resolve({
        orderId: 'twoday_1_abcd12',
        code: 'USER_CANCEL',
        message: '사용자가 결제를 취소했습니다.',
      }),
    }));

    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1991-03-15');
    expect(calls).not.toContain('14:30');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
    consoleSpy.mockRestore();
  });

  it('URL message의 PII 조각을 화면과 실패 기록에 그대로 남기지 않는다', async () => {
    render(await PaymentsFailPage({
      searchParams: Promise.resolve({
        orderId: 'twoday_1_abcd12',
        code: 'PAYMENT_FAILED',
        message:
          'gateway failed birth_date=1991-03-15 user_email=minji@example.com relation_nickname="민지"',
      }),
    }));

    expect(document.body.textContent).not.toContain('1991-03-15');
    expect(document.body.textContent).not.toContain('minji@example.com');
    expect(document.body.textContent).not.toContain('민지');
    expect(document.body.textContent).toContain('birth_date=[redacted]');
    expect(document.body.textContent).toContain('user_email=[redacted]');
    expect(document.body.textContent).toContain('relation_nickname=[redacted]');
    expect(markPaymentFailedForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'gateway failed birth_date=[redacted] user_email=[redacted] relation_nickname=[redacted]',
      }),
    );
  });
});
