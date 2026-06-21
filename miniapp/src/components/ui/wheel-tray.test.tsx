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

  it('aria-modal 과 포커스 가능한 다이얼로그(tabIndex -1)를 둔다', () => {
    renderWithProviders(
      <WheelTray open title="t" onCancel={vi.fn()} onDone={vi.fn()}>
        <div />
      </WheelTray>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('Escape 키로 취소한다', () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <WheelTray open title="t" onCancel={onCancel} onDone={vi.fn()}>
        <div />
      </WheelTray>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('backdrop·dialog 에 pointer-events:auto 를 둔다 (vaul 모달 중첩 시 죽지 않도록)', () => {
    renderWithProviders(
      <WheelTray open title="t" onCancel={vi.fn()} onDone={vi.fn()}>
        <div />
      </WheelTray>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.pointerEvents).toBe('auto');
    const backdrop = dialog.previousElementSibling as HTMLElement;
    expect(backdrop?.style.pointerEvents).toBe('auto');
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
