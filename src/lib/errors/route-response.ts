import { NextResponse } from 'next/server';

export function apiErrorResponse(code: string, message = '', status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// pay-per-use 402 (ADR-039, 모델 C). 잔액 부족 선생성 후 클라이언트 결제 시트가 필요로 하는
// {feature, ref, amount_krw} 를 표준 error 봉투와 함께 최상위로 실어 보낸다.
// amount_krw 는 FeaturePaymentInit 계약과 동일 필드명(price_krw 아님).
export function paymentRequiredResponse(feature: string, ref: string, amountKrw: number) {
  return NextResponse.json(
    {
      error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
      feature,
      ref,
      amount_krw: amountKrw,
    },
    { status: 402 },
  );
}
