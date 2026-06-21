import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { FeaturePayCard } from './feature-pay-card';

function baseProps() {
  return {
    title: '케미카드는 ₩550이 필요해요',
    amountKrw: 550,
    consentChecked: false,
    onConsentChange: vi.fn(),
    isPurchasing: false,
    onPay: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('FeaturePayCard', () => {
  it('제목·금액 결제 버튼·닫기 버튼·청약철회 동의를 렌더한다', () => {
    renderWithProviders(<FeaturePayCard {...baseProps()} description="결제 후 바로 케미카드를 확인할 수 있어요." />);
    expect(screen.getByText('케미카드는 ₩550이 필요해요')).toBeInTheDocument();
    expect(screen.getByText('결제 후 바로 케미카드를 확인할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /₩550 결제하기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('동의 전에는 결제 버튼이 비활성, 동의하면 활성화된다 (전자상거래법 §17 게이트)', () => {
    const { rerender } = renderWithProviders(<FeaturePayCard {...baseProps()} consentChecked={false} />);
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeDisabled();
    rerender(<FeaturePayCard {...baseProps()} consentChecked={true} />);
    expect(screen.getByRole('button', { name: /결제하기/ })).not.toBeDisabled();
  });

  it('isPurchasing 이면 결제 버튼이 비활성 + "결제 중…" 라벨', () => {
    renderWithProviders(<FeaturePayCard {...baseProps()} consentChecked isPurchasing />);
    const payBtn = screen.getByRole('button', { name: '결제 중…' });
    expect(payBtn).toBeDisabled();
  });

  it('payDisabled 이면 동의했어도 결제 버튼이 비활성 (payInfo 부재 가드)', () => {
    renderWithProviders(<FeaturePayCard {...baseProps()} consentChecked payDisabled />);
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeDisabled();
  });

  it('활성 상태에서 결제 클릭 시 onPay 를 호출한다', async () => {
    const onPay = vi.fn();
    renderWithProviders(<FeaturePayCard {...baseProps()} consentChecked onPay={onPay} />);
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('닫기 클릭 시 onClose 를 호출한다', async () => {
    const onClose = vi.fn();
    renderWithProviders(<FeaturePayCard {...baseProps()} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('동의 체크박스 토글 시 onConsentChange 를 호출한다', async () => {
    const onConsentChange = vi.fn();
    renderWithProviders(<FeaturePayCard {...baseProps()} onConsentChange={onConsentChange} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onConsentChange).toHaveBeenCalledWith(true);
  });

  it('hasError 이면 결제 오류 안내를 표시한다', () => {
    renderWithProviders(<FeaturePayCard {...baseProps()} hasError />);
    expect(screen.getByText(/결제 중 오류가 발생했어요/)).toBeInTheDocument();
  });

  it('hasError 가 아니면 오류 안내를 표시하지 않는다', () => {
    renderWithProviders(<FeaturePayCard {...baseProps()} />);
    expect(screen.queryByText(/결제 중 오류가 발생했어요/)).not.toBeInTheDocument();
  });

  it('consentNotice 로 청약철회 고지 문구를 재정의한다 (인연 슬롯)', () => {
    renderWithProviders(
      <FeaturePayCard
        {...baseProps()}
        consentNotice="인연 등록이 완료되면 「전자상거래법」상 청약철회가 제한됩니다."
      />,
    );
    expect(screen.getByText(/인연 등록이 완료되면/)).toBeInTheDocument();
  });

  it('closeLabel 로 닫기 라벨을 재정의한다', () => {
    renderWithProviders(<FeaturePayCard {...baseProps()} closeLabel="나중에" />);
    expect(screen.getByRole('button', { name: '나중에' })).toBeInTheDocument();
  });

  it('testId 를 루트 컨테이너에 적용한다', () => {
    renderWithProviders(<FeaturePayCard {...baseProps()} testId="whatif-pay-required" />);
    expect(screen.getByTestId('whatif-pay-required')).toBeInTheDocument();
  });
});
