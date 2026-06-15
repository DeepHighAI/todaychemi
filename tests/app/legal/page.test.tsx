// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('legal pages', () => {
  it('/legal/terms renders the official terms document title and effective date', async () => {
    const { default: TermsPage } = await import('@/app/legal/terms/page');
    render(await TermsPage());

    expect(screen.getByRole('heading', { name: '오늘케미 서비스 이용약관' })).toBeInTheDocument();
    expect(screen.getAllByText(/2026년 6월 1일/).length).toBeGreaterThan(0);
  });

  it('/legal/privacy renders the official privacy document title and a GFM table', async () => {
    const { default: PrivacyPage } = await import('@/app/legal/privacy/page');
    render(await PrivacyPage());

    expect(
      screen.getByRole('heading', { name: '오늘케미 개인정보 처리방침' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
  });

  it('/legal/refund renders the launch refund policy', async () => {
    const { default: RefundPage } = await import('@/app/legal/refund/page');
    render(await RefundPage());

    expect(screen.getByRole('heading', { name: '오늘케미 환불 정책' })).toBeInTheDocument();
    // pay-per-use 재작성(2026-06-15): 폐지된 "부적 충전" 대신 청약철회 기준을 검증
    expect(screen.getAllByText(/청약철회/).length).toBeGreaterThan(0);
  });
});
