import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { RewardNotice } from './reward-notice';

describe('RewardNotice', () => {
  it('가입 보상이면 비모달 상태 알림으로 환영 타이틀과 획득 부적 수를 노출한다', () => {
    renderWithProviders(<RewardNotice amount={50} isSignup onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('환영해요! 부적을 선물로 받았어요')).toBeInTheDocument();
    expect(screen.getByText('+50')).toBeInTheDocument();
    expect(screen.getByText(/케미카드/)).toBeInTheDocument();
  });

  it('출석 보상이면 출석 타이틀을 노출한다', () => {
    renderWithProviders(<RewardNotice amount={5} isSignup={false} onClose={vi.fn()} />);
    expect(screen.getByText('오늘의 출석 부적을 받았어요')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('닫기 버튼을 누르면 onClose 를 호출한다', async () => {
    const onClose = vi.fn();
    renderWithProviders(<RewardNotice amount={50} isSignup onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: '보상 안내 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
