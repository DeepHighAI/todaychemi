// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import PaymentsSuccessPage from '@/app/payments/success/page';

describe('/payments/success page', () => {
  it('성공 화면과 지갑 CTA를 표시한다', async () => {
    render(await PaymentsSuccessPage({
      searchParams: Promise.resolve({ orderId: 'twoday_1_abcd12' }),
    }));

    expect(screen.getByText('부적 충전 완료')).toBeInTheDocument();
    expect(screen.getByText('주문번호 twoday_1_abcd12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /내 사주맵/ })).toHaveAttribute('href', '/me');
  });
});
