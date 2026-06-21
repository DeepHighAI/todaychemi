import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { WheelTray } from './wheel-tray';

describe('WheelTray', () => {
  it('open 시 제목·취소·완료·children 을 렌더한다', () => {
    renderWithProviders(
      <WheelTray open title="생년월일" onCancel={vi.fn()} onDone={vi.fn()}>
        <div>WHEELS</div>
      </WheelTray>,
    );
    expect(screen.getByRole('dialog', { name: '생년월일' })).toBeInTheDocument();
    expect(screen.getByText('취소')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.getByText('WHEELS')).toBeInTheDocument();
  });

  it('취소/완료 클릭 시 각 콜백을 호출한다', () => {
    const onCancel = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(
      <WheelTray open title="t" onCancel={onCancel} onDone={onDone}>
        <div />
      </WheelTray>,
    );
    fireEvent.click(screen.getByText('취소'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('완료'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('open=false 면 아무것도 렌더하지 않는다', () => {
    renderWithProviders(
      <WheelTray open={false} title="t" onCancel={vi.fn()} onDone={vi.fn()}>
        <div>HIDDEN</div>
      </WheelTray>,
    );
    expect(screen.queryByText('HIDDEN')).toBeNull();
  });
});
