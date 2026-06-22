import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('open 이면 제목·설명·확인/닫기 버튼을 렌더한다', () => {
    renderWithProviders(
      <ConfirmDialog
        open
        title="삭제할까요?"
        description="되돌릴 수 없어요"
        confirmLabel="삭제"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('삭제할까요?')).toBeInTheDocument();
    expect(screen.getByText('되돌릴 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
  });

  it('확인 클릭 시 onConfirm 을 호출한다', async () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog open title="t" confirmLabel="삭제" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('닫기 클릭 시 onCancel 을 호출한다', async () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <ConfirmDialog open title="t" confirmLabel="삭제" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('open=false 면 렌더하지 않는다', () => {
    renderWithProviders(
      <ConfirmDialog open={false} title="삭제할까요?" confirmLabel="삭제" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByText('삭제할까요?')).not.toBeInTheDocument();
  });

  it('isPending 이면 확인 버튼이 비활성', () => {
    renderWithProviders(
      <ConfirmDialog open title="t" confirmLabel="삭제" isPending onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
  });

  it('variant=destructive 면 확인 버튼이 --destructive 색', () => {
    renderWithProviders(
      <ConfirmDialog open title="t" confirmLabel="삭제" variant="destructive" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: '삭제' }).style.color).toContain('var(--destructive)');
  });

  it('커스텀 cancelLabel 을 적용한다', () => {
    renderWithProviders(
      <ConfirmDialog open title="t" confirmLabel="삭제" cancelLabel="뒤로" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument();
  });
});
