// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/render-with-providers';
import { MemoSheet } from '@/components/memo/memo-sheet';

const DEFAULT_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  mode: 'create' as const,
  onSubmit: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('MemoSheet — 렌더', () => {
  it('textarea 와 counter 가 표시됨', () => {
    renderWithProviders(<MemoSheet {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('memo-sheet-input')).toBeInTheDocument();
    expect(screen.getByTestId('memo-sheet-counter')).toBeInTheDocument();
  });

  it('초기 counter 는 0/80', () => {
    renderWithProviders(<MemoSheet {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('memo-sheet-counter').textContent).toBe('0/80');
  });

  it('텍스트 입력 시 counter 업데이트', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MemoSheet {...DEFAULT_PROPS} />);
    await user.type(screen.getByTestId('memo-sheet-input'), 'abc');
    expect(screen.getByTestId('memo-sheet-counter').textContent).toBe('3/80');
  });

  it('빈 상태에서 submit 버튼 disabled', () => {
    renderWithProviders(<MemoSheet {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('memo-sheet-submit')).toBeDisabled();
  });

  it('텍스트 입력 후 submit 버튼 활성화', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MemoSheet {...DEFAULT_PROPS} />);
    await user.type(screen.getByTestId('memo-sheet-input'), '안녕');
    expect(screen.getByTestId('memo-sheet-submit')).not.toBeDisabled();
  });

  it('submit 클릭 시 onSubmit(body) 호출', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<MemoSheet {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    await user.type(screen.getByTestId('memo-sheet-input'), '좋아요');
    await user.click(screen.getByTestId('memo-sheet-submit'));
    expect(onSubmit).toHaveBeenCalledWith('좋아요');
  });

  it('edit 모드에서 initialBody 로 prefill', () => {
    renderWithProviders(
      <MemoSheet {...DEFAULT_PROPS} mode="edit" initialBody="기존 메모" />,
    );
    expect((screen.getByTestId('memo-sheet-input') as HTMLTextAreaElement).value).toBe('기존 메모');
  });

  it('edit 모드 counter 는 initialBody 길이로 시작', () => {
    renderWithProviders(
      <MemoSheet {...DEFAULT_PROPS} mode="edit" initialBody="기존 메모" />,
    );
    const len = [...'기존 메모'].length; // 5
    expect(screen.getByTestId('memo-sheet-counter').textContent).toBe(`${len}/80`);
  });
});

describe('MemoSheet — 80자 상한 및 submitting 상태', () => {
  it('maxLength=80 속성이 textarea 에 설정됨', () => {
    renderWithProviders(<MemoSheet {...DEFAULT_PROPS} />);
    const ta = screen.getByTestId('memo-sheet-input') as HTMLTextAreaElement;
    expect(ta.maxLength).toBe(80);
  });

  it('submitting=true 이면 submit 버튼 disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MemoSheet {...DEFAULT_PROPS} submitting />);
    await user.type(screen.getByTestId('memo-sheet-input'), '안녕');
    expect(screen.getByTestId('memo-sheet-submit')).toBeDisabled();
  });
});
