// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithIntl } from '../../utils/render-with-intl';
import { RewardPopup } from '@/components/rewards/reward-popup';

describe('RewardPopup (web)', () => {
  it('가입 보상이면 환영 타이틀 + 획득 부적 수 + 사용 용도를 노출한다', () => {
    renderWithIntl(<RewardPopup open amount={50} isSignup onClose={vi.fn()} />);
    expect(screen.getByText('환영해요! 부적을 선물로 받았어요')).toBeInTheDocument();
    expect(screen.getByText('부적 50개')).toBeInTheDocument();
    expect(screen.getByText(/케미카드/)).toBeInTheDocument();
  });

  it('출석 보상이면 출석 타이틀을 노출한다', () => {
    renderWithIntl(<RewardPopup open amount={5} isSignup={false} onClose={vi.fn()} />);
    expect(screen.getByText('오늘의 출석 부적을 받았어요')).toBeInTheDocument();
    expect(screen.getByText('부적 5개')).toBeInTheDocument();
  });

  it('확인 버튼을 누르면 onClose 를 호출한다', async () => {
    const onClose = vi.fn();
    renderWithIntl(<RewardPopup open amount={50} isSignup onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('open=false 면 렌더하지 않는다', () => {
    renderWithIntl(<RewardPopup open={false} amount={50} isSignup onClose={vi.fn()} />);
    expect(screen.queryByText('환영해요! 부적을 선물로 받았어요')).not.toBeInTheDocument();
  });
});
