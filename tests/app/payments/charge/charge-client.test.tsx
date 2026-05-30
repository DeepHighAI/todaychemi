// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

const tossMocks = vi.hoisted(() => ({
  setAmount: vi.fn(),
  renderPaymentMethods: vi.fn(),
  renderAgreement: vi.fn(),
  requestPayment: vi.fn(),
  loadTossPayments: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigationMocks.replace, push: navigationMocks.push }),
  useSearchParams: () => navigationMocks.searchParams,
}));

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  loadTossPayments: tossMocks.loadTossPayments,
}));

import ChargeClient from '@/app/payments/charge/charge-client';

const ORDER = {
  payment_id: 'payment-001',
  toss_order_id: 'twoday_1_abcd12',
  product_id: 'tokens_50',
  amount_krw: 4500,
  token_amount: 55,
  order_name: '부적 55개',
  status: 'pending',
  client_key: 'test_ck_widget',
  customer_key: 'customer_00000000-0000-4000-8000-000000000001',
};

beforeEach(() => {
  vi.clearAllMocks();
  navigationMocks.searchParams = new URLSearchParams();
  tossMocks.setAmount.mockResolvedValue(undefined);
  tossMocks.renderPaymentMethods.mockResolvedValue(undefined);
  tossMocks.renderAgreement.mockResolvedValue(undefined);
  tossMocks.requestPayment.mockResolvedValue(undefined);
  tossMocks.loadTossPayments.mockResolvedValue({
    widgets: vi.fn().mockReturnValue({
      setAmount: tossMocks.setAmount,
      renderPaymentMethods: tossMocks.renderPaymentMethods,
      renderAgreement: tossMocks.renderAgreement,
      requestPayment: tossMocks.requestPayment,
    }),
  });
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/payments/init')) {
      return Promise.resolve(new Response(JSON.stringify({
        ok: true,
        payment: {
          payment_id: ORDER.payment_id,
          toss_order_id: ORDER.toss_order_id,
          product_id: ORDER.product_id,
          amount_krw: ORDER.amount_krw,
          token_amount: ORDER.token_amount,
          order_name: ORDER.order_name,
          status: ORDER.status,
          customer_key: ORDER.customer_key,
        },
      }), { status: 201 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true, order: ORDER }), { status: 200 }));
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/payments/charge ChargeClient', () => {
  it('상품 선택과 Payment Widget 컨테이너를 렌더한다', () => {
    render(<ChargeClient />);

    expect(screen.getByText('부적 충전')).toBeInTheDocument();
    expect(screen.getByText('55부적')).toBeInTheDocument();
    expect(document.getElementById('payment-methods')).toBeInTheDocument();
    expect(document.getElementById('payment-agreement')).toBeInTheDocument();
  });

  it('주문 생성 후 V2 Payment Widget을 문서 순서대로 mount한다', async () => {
    render(<ChargeClient />);

    fireEvent.click(screen.getByRole('button', { name: '₩4,500 결제수단 선택' }));

    await waitFor(() => expect(tossMocks.loadTossPayments).toHaveBeenCalledWith('test_ck_widget'));
    expect(tossMocks.setAmount).toHaveBeenCalledWith({ value: 4500, currency: 'KRW' });
    expect(tossMocks.renderPaymentMethods).toHaveBeenCalledWith({
      selector: '#payment-methods',
      variantKey: 'DEFAULT',
    });
    expect(tossMocks.renderAgreement).toHaveBeenCalledWith({
      selector: '#payment-agreement',
      variantKey: 'AGREEMENT',
    });
    expect(await screen.findByRole('button', { name: '₩4,500 결제하기' })).toBeInTheDocument();
  });

  it('결제 준비 중에는 요청 버튼이 disabled 상태가 된다', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}));
    render(<ChargeClient />);

    fireEvent.click(screen.getByRole('button', { name: '₩4,500 결제수단 선택' }));

    expect(await screen.findByRole('button', { name: '결제 준비 중…' })).toBeDisabled();
  });

  it('비로그인 상태에서는 로그인 안내와 CTA를 보여준다', async () => {
    render(<ChargeClient authenticated={false} />);

    expect(await screen.findByText('로그인이 필요해요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '로그인하고 충전' }));
    expect(navigationMocks.push).toHaveBeenCalledWith('/login?next=/payments/charge');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('기존 주문 조회가 이미 완료 상태이면 성공 페이지로 보낸다', async () => {
    navigationMocks.searchParams = new URLSearchParams({ orderId: ORDER.toss_order_id });
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      error: { code: 'PAYMENT_ALREADY_CONFIRMED', message: '이미 완료된 결제 주문입니다.' },
    }), { status: 409 })));

    render(<ChargeClient />);

    await waitFor(() => expect(navigationMocks.replace).toHaveBeenCalledWith(
      `/payments/success?orderId=${encodeURIComponent(ORDER.toss_order_id)}`,
    ));
    expect(tossMocks.loadTossPayments).not.toHaveBeenCalled();
  });

  it('재결제 불가 주문은 Toss SDK를 mount하지 않고 새 충전 CTA를 보여준다', async () => {
    navigationMocks.searchParams = new URLSearchParams({ orderId: ORDER.toss_order_id });
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      error: { code: 'PAYMENT_NOT_PAYABLE', message: '다시 결제할 수 없는 주문입니다.' },
    }), { status: 409 })));

    render(<ChargeClient />);

    await waitFor(() => expect(screen.queryByText('이 주문은 다시 결제할 수 없어요')).not.toBeNull());
    expect(screen.getByRole('button', { name: '새 주문으로 다시 충전' })).toBeInTheDocument();
    expect(tossMocks.loadTossPayments).not.toHaveBeenCalled();
    expect(tossMocks.requestPayment).not.toHaveBeenCalled();
  });

  it('requestPayment에는 문서 기준 필드만 전달한다', async () => {
    render(<ChargeClient />);

    fireEvent.click(screen.getByRole('button', { name: '₩4,500 결제수단 선택' }));
    fireEvent.click(await screen.findByRole('button', { name: '₩4,500 결제하기' }));

    await waitFor(() => expect(tossMocks.requestPayment).toHaveBeenCalledOnce());
    expect(tossMocks.requestPayment.mock.calls[0]?.[0]).toEqual({
      orderId: ORDER.toss_order_id,
      orderName: ORDER.order_name,
      successUrl: `${window.location.origin}/api/payments/confirm`,
      failUrl: `${window.location.origin}/payments/fail`,
    });
  });
});
