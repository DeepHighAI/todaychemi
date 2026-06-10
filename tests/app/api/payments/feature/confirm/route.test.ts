import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/payments/feature-complete');
vi.mock('@/lib/relations/materialize');

import { GET } from '@/app/api/payments/feature/confirm/route';
import { confirmFeaturePaymentForUser } from '@/lib/payments/feature-complete';
import { PaymentFlowError } from '@/lib/payments/complete';
import { materializeRelationSlot } from '@/lib/relations/materialize';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import * as Sentry from '@sentry/nextjs';

const USER_ID = 'user-feat-001';
const REF = 'cache-key-abc';

function makeClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

function url(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/payments/feature/confirm?${qs}`);
}

const OK_PARAMS = {
  paymentKey: 'pay-key',
  orderId: 'twoday_1_abcd12',
  amount: '1000',
  feature: 'hapcard',
  ref: REF,
  next: '/hapcard/abc',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue(makeClient() as never);
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(), rpc: vi.fn() } as never);
  vi.mocked(confirmFeaturePaymentForUser).mockResolvedValue({
    status: 'confirmed',
    feature: 'hapcard',
    ref: REF,
  });
  vi.mocked(materializeRelationSlot).mockResolvedValue('rel-uuid-1');
});

describe('GET /api/payments/feature/confirm', () => {
  it('성공 → confirm 후 next(allowlist)로 303, paid=ref 부착', async () => {
    const res = await GET(url(OK_PARAMS));

    expect(confirmFeaturePaymentForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      orderId: 'twoday_1_abcd12',
      paymentKey: 'pay-key',
      amount: 1000,
      feature: 'hapcard',
      ref: REF,
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`http://localhost/hapcard/abc?paid=${REF}`);
  });

  it('replay=1 → next 에 replay=1 부착', async () => {
    const res = await GET(url({ ...OK_PARAMS, feature: 'replay', next: '/hapcard/abc', replay: '1' }));

    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('paid=');
    expect(loc).toContain('replay=1');
  });

  it('open-redirect 방지 — allowlist 밖 next 는 /feed 로 대체', async () => {
    const res = await GET(url({ ...OK_PARAMS, next: '//evil.com/phish' }));

    const loc = res.headers.get('location') ?? '';
    expect(loc).not.toContain('evil.com');
    expect(loc).toContain('/feed');
    expect(loc).toContain(`paid=${REF}`);
    // 결제는 정상 확정됨 (돈은 실제로 받음)
    expect(confirmFeaturePaymentForUser).toHaveBeenCalled();
  });

  it('amount 가 정수 아니면 confirm 미호출, 실패 페이지', async () => {
    const res = await GET(url({ ...OK_PARAMS, amount: 'abc' }));

    expect(confirmFeaturePaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/payments/fail');
    expect(res.headers.get('location')).toContain('PAYMENT_CONFIRM_INVALID');
  });

  it('amount 파라미터 누락 → confirm 미호출, 주문 tampered 오염 없이 실패 페이지', async () => {
    const { amount: _amount, ...paramsWithoutAmount } = OK_PARAMS;

    const res = await GET(url(paramsWithoutAmount));

    expect(confirmFeaturePaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/payments/fail');
    expect(res.headers.get('location')).toContain('PAYMENT_CONFIRM_INVALID');
  });

  it('알 수 없는 feature → confirm 미호출, 실패 페이지', async () => {
    const res = await GET(url({ ...OK_PARAMS, feature: 'tokens_10' }));

    expect(confirmFeaturePaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/payments/fail');
  });

  it('확정 실패(변조) → 실패 페이지 + 코드', async () => {
    vi.mocked(confirmFeaturePaymentForUser).mockRejectedValue(
      new PaymentFlowError('PAYMENT_AMOUNT_MISMATCH', '결제 금액이 주문과 다릅니다.', 400),
    );

    const res = await GET(url(OK_PARAMS));

    expect(res.headers.get('location')).toContain('/payments/fail');
    expect(res.headers.get('location')).toContain('PAYMENT_AMOUNT_MISMATCH');
  });

  it('확정 실패 로그와 실패 redirect message에 raw PII를 남기지 않는다', async () => {
    vi.mocked(confirmFeaturePaymentForUser).mockRejectedValue(
      new Error(
        'gateway failed birth_date=1991-03-15 user_email=minji@example.com relation_nickname="민지"',
      ),
    );

    const res = await GET(url(OK_PARAMS));

    const location = decodeURIComponent(res.headers.get('location') ?? '');
    const sentryError = vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error;

    expect(location).toContain('/payments/fail');
    expect(location).toContain('PAYMENT_CONFIRM_FAILED');
    expect(location).not.toContain('1991-03-15');
    expect(location).not.toContain('minji@example.com');
    expect(location).not.toContain('민지');
    expect(location).toContain('birth_date=[redacted]');
    expect(location).toContain('user_email=[redacted]');
    expect(location).toContain('relation_nickname=[redacted]');

    expect(sentryError.message).not.toContain('1991-03-15');
    expect(sentryError.message).not.toContain('minji@example.com');
    expect(sentryError.message).not.toContain('민지');
    expect(sentryError.message).toContain('birth_date=[redacted]');
    expect(sentryError.message).toContain('user_email=[redacted]');
    expect(sentryError.message).toContain('relation_nickname=[redacted]');
  });

  it('미인증 → confirm 미호출, 실패 페이지 UNAUTHORIZED', async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient(null) as never);

    const res = await GET(url(OK_PARAMS));

    expect(confirmFeaturePaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('UNAUTHORIZED');
  });
});

describe('GET /api/payments/feature/confirm — relation_slot 머티리얼라이즈 훅', () => {
  const SLOT_REF = 'relation_slot:pend-uuid-7';
  const SLOT_PARAMS = {
    paymentKey: 'pay-key',
    orderId: 'twoday_1_slot001',
    amount: '1000',
    feature: 'relation_slot',
    ref: SLOT_REF,
    next: '/feed',
  };

  beforeEach(() => {
    vi.mocked(confirmFeaturePaymentForUser).mockResolvedValue({
      status: 'confirmed',
      feature: 'relation_slot',
      ref: SLOT_REF,
    });
  });

  it('확정 성공 → pending_id 파싱해 머티리얼라이즈 + /feed?paid=ref 303', async () => {
    const res = await GET(url(SLOT_PARAMS));

    expect(materializeRelationSlot).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      'pend-uuid-7',
    );
    expect(res.status).toBe(303);
    const loc = decodeURIComponent(res.headers.get('location') ?? '');
    expect(loc).toContain('/feed');
    expect(loc).toContain(`paid=${SLOT_REF}`);
    expect(loc).not.toContain('/payments/fail');
  });

  it('머티리얼라이즈 실패 → 결제 확정 후엔 절대 실패 리다이렉트 금지 (Sentry 로깅 + paid 진행)', async () => {
    vi.mocked(materializeRelationSlot).mockRejectedValue(new Error('insert blew up'));

    const res = await GET(url(SLOT_PARAMS));

    expect(res.status).toBe(303);
    const loc = decodeURIComponent(res.headers.get('location') ?? '');
    expect(loc).not.toContain('/payments/fail');
    expect(loc).toContain(`paid=${SLOT_REF}`);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('already_confirmed 재진입(브라우저 뒤로가기/새로고침)도 머티리얼라이즈 멱등 수렴', async () => {
    vi.mocked(confirmFeaturePaymentForUser).mockResolvedValue({
      status: 'already_confirmed',
      feature: 'relation_slot',
      ref: SLOT_REF,
    });

    const res = await GET(url(SLOT_PARAMS));

    expect(materializeRelationSlot).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      'pend-uuid-7',
    );
    expect(res.status).toBe(303);
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain(`paid=${SLOT_REF}`);
  });

  it('shape 위반 ref(relation_slot:비정형) → 머티리얼라이즈 스킵 + Sentry, fail redirect 없이 진행', async () => {
    const badRefs = ['relation_slot:', 'relation_slot:a:b', 'garbage'];
    for (const badRef of badRefs) {
      vi.clearAllMocks();
      vi.mocked(createClient).mockResolvedValue(makeClient() as never);
      vi.mocked(confirmFeaturePaymentForUser).mockResolvedValue({
        status: 'confirmed',
        feature: 'relation_slot',
        ref: badRef,
      });

      const res = await GET(url({ ...SLOT_PARAMS, ref: badRef }));

      // 돈은 이미 확정 — 절대 fail redirect 금지, 다만 비정형 ref 로 materialize 시도 금지
      expect(materializeRelationSlot).not.toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalled();
      expect(res.status).toBe(303);
      expect(res.headers.get('location') ?? '').not.toContain('/payments/fail');
    }
  });

  it('비 relation_slot 피처(hapcard)는 머티리얼라이즈 미호출', async () => {
    vi.mocked(confirmFeaturePaymentForUser).mockResolvedValue({
      status: 'confirmed',
      feature: 'hapcard',
      ref: REF,
    });

    await GET(url(OK_PARAMS));

    expect(materializeRelationSlot).not.toHaveBeenCalled();
  });

  it("resolveNext allowlist 에 '/feed' 명시 허용 (쿼리 보존)", async () => {
    const res = await GET(url({ ...SLOT_PARAMS, next: '/feed?focus=abc' }));

    const loc = decodeURIComponent(res.headers.get('location') ?? '');
    expect(loc).toContain('/feed');
    expect(loc).toContain('focus=abc');
    expect(loc).toContain(`paid=${SLOT_REF}`);
  });
});
