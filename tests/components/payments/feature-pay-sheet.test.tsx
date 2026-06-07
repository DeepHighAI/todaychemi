// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../utils/render-with-providers';

const toss = vi.hoisted(() => ({
  setAmount: vi.fn(),
  renderPaymentMethods: vi.fn(),
  renderAgreement: vi.fn(),
  requestPayment: vi.fn(),
  loadTossPayments: vi.fn(),
}));

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  loadTossPayments: toss.loadTossPayments,
}));

import { FeaturePaySheet } from '@/components/payments/feature-pay-sheet';

const PAYMENT = {
  order_id: 'twoday_feat_1',
  customer_key: 'cust_feat_1',
  client_key: 'test_gck_feat',
  amount_krw: 1000,
  order_name: '케미카드 보기',
  feature: 'hapcard',
  ref: 'cache-abc',
};

function mockInit(body: unknown, status = 201) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

beforeEach(() => {
  vi.clearAllMocks();
  toss.setAmount.mockResolvedValue(undefined);
  toss.renderPaymentMethods.mockResolvedValue(undefined);
  toss.renderAgreement.mockResolvedValue(undefined);
  toss.requestPayment.mockResolvedValue(undefined);
  toss.loadTossPayments.mockResolvedValue({
    widgets: vi.fn().mockReturnValue({
      setAmount: toss.setAmount,
      renderPaymentMethods: toss.renderPaymentMethods,
      renderAgreement: toss.renderAgreement,
      requestPayment: toss.requestPayment,
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseProps = {
  feature: 'hapcard' as const,
  featureRef: 'cache-abc',
  next: '/hapcard/hap-1?mode=일합',
  open: true,
  onOpenChange: vi.fn(),
};

describe('FeaturePaySheet', () => {
  it('open → /api/payments/feature/init 에 {feature, ref} POST', async () => {
    mockInit({ ok: true, unlocked: false, payment: PAYMENT });
    renderWithProviders(<FeaturePaySheet {...baseProps} />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('/api/payments/feature/init');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ feature: 'hapcard', ref: 'cache-abc' });
  });

  it('unlocked:true → 위젯 마운트 없이 onPaid + onOpenChange(false)', async () => {
    mockInit({ ok: true, unlocked: true }, 200);
    const onPaid = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <FeaturePaySheet {...baseProps} onOpenChange={onOpenChange} onPaid={onPaid} />,
    );

    await waitFor(() => expect(onPaid).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toss.loadTossPayments).not.toHaveBeenCalled();
  });

  it('unlocked:false → Toss 위젯을 전용 selector 로 마운트', async () => {
    mockInit({ ok: true, unlocked: false, payment: PAYMENT });
    renderWithProviders(<FeaturePaySheet {...baseProps} />);

    await waitFor(() => expect(toss.loadTossPayments).toHaveBeenCalledWith('test_gck_feat'));
    expect(toss.setAmount).toHaveBeenCalledWith({ value: 1000, currency: 'KRW' });
    expect(toss.renderPaymentMethods).toHaveBeenCalledWith({
      selector: '#feature-payment-methods',
      variantKey: 'DEFAULT',
    });
    expect(toss.renderAgreement).toHaveBeenCalledWith({
      selector: '#feature-payment-agreement',
      variantKey: 'AGREEMENT',
    });
  });

  it('결제하기 → requestPayment(successUrl 에 feature/ref/next, failUrl)', async () => {
    mockInit({ ok: true, unlocked: false, payment: PAYMENT });
    renderWithProviders(<FeaturePaySheet {...baseProps} />);

    const payBtn = await screen.findByRole('button', { name: /결제하기/ });
    fireEvent.click(payBtn);

    await waitFor(() => expect(toss.requestPayment).toHaveBeenCalledOnce());
    const arg = toss.requestPayment.mock.calls[0][0];
    expect(arg.orderId).toBe('twoday_feat_1');
    expect(arg.orderName).toBe('케미카드 보기');
    const origin = window.location.origin;
    expect(arg.successUrl).toBe(
      `${origin}/api/payments/feature/confirm?feature=hapcard&ref=${encodeURIComponent(
        'cache-abc',
      )}&next=${encodeURIComponent('/hapcard/hap-1?mode=일합')}`,
    );
    expect(arg.failUrl).toBe(`${origin}/payments/fail`);
  });

  it('replay=true → successUrl 에 &replay=1 추가', async () => {
    mockInit({
      ok: true,
      unlocked: false,
      payment: {
        ...PAYMENT,
        feature: 'replay',
        order_name: '케미 다시 맞추기',
        amount_krw: 600,
        ref: 'replay:hap-1:2026-06-02',
      },
    });
    renderWithProviders(
      <FeaturePaySheet
        feature="replay"
        featureRef="replay:hap-1:2026-06-02"
        next="/hapcard/hap-1?mode=일합"
        replay
        open
        onOpenChange={vi.fn()}
      />,
    );

    const payBtn = await screen.findByRole('button', { name: /결제하기/ });
    fireEvent.click(payBtn);

    await waitFor(() => expect(toss.requestPayment).toHaveBeenCalledOnce());
    expect(toss.requestPayment.mock.calls[0][0].successUrl).toContain('&replay=1');
  });

  it('init 실패(404) → 위젯 마운트 없이 에러 표시', async () => {
    mockInit({ error: { code: 'PAYMENT_REF_NOT_FOUND', message: 'x' } }, 404);
    renderWithProviders(<FeaturePaySheet {...baseProps} />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '결제를 시작할 수 없어요. 잠시 후 다시 시도해주세요.',
      ),
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
    expect(toss.loadTossPayments).not.toHaveBeenCalled();
  });

  it('Toss 설정 누락 → 설정 안내를 보여주고 재시도할 수 있음', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: { code: 'PAYMENT_CONFIG_MISSING', message: 'payment provider is not configured' },
            }),
            { status: 503 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true, unlocked: false, payment: PAYMENT }), {
            status: 201,
          }),
        ),
    );
    renderWithProviders(<FeaturePaySheet {...baseProps} />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '결제 설정이 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.',
      ),
    );
    expect(toss.loadTossPayments).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(toss.loadTossPayments).toHaveBeenCalledWith('test_gck_feat'));
  });

  it('open=false → init 호출 안 함', () => {
    mockInit({ ok: true, unlocked: false, payment: PAYMENT });
    renderWithProviders(<FeaturePaySheet {...baseProps} open={false} />);
    expect(fetch).not.toHaveBeenCalled();
  });
});
