// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/render-with-providers';
import { MemoList } from '@/components/memo/memo-list';
import type { MemoItem } from '@/types/memo';

const MEMO_1: MemoItem = {
  memo_id: 'memo-1',
  relation_id: 'rel-1',
  body: '첫 번째 메모',
  created_at: '2026-05-28T09:00:00Z',
  updated_at: '2026-05-28T09:00:00Z',
};

const MEMO_2: MemoItem = {
  memo_id: 'memo-2',
  relation_id: 'rel-1',
  body: '두 번째 메모',
  created_at: '2026-05-28T10:00:00Z',
  updated_at: '2026-05-28T10:00:00Z',
};

const DEFAULT_PROPS = {
  items: [],
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('MemoList — 빈 상태', () => {
  it('items 0건이면 빈 상태 메시지 표시', () => {
    renderWithProviders(<MemoList {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('memo-list')).toBeInTheDocument();
    expect(screen.getByText(/아직 메모가 없어요/)).toBeInTheDocument();
  });
});

describe('MemoList — 목록', () => {
  it('각 memo 에 대해 memo-row-{id} testid 표시', () => {
    renderWithProviders(<MemoList {...DEFAULT_PROPS} items={[MEMO_1, MEMO_2]} />);
    expect(screen.getByTestId('memo-row-memo-1')).toBeInTheDocument();
    expect(screen.getByTestId('memo-row-memo-2')).toBeInTheDocument();
  });

  it('body 텍스트 표시', () => {
    renderWithProviders(<MemoList {...DEFAULT_PROPS} items={[MEMO_1]} />);
    expect(screen.getByText('첫 번째 메모')).toBeInTheDocument();
  });

  it('수정 버튼 클릭 → onEdit(item) 호출', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(<MemoList {...DEFAULT_PROPS} items={[MEMO_1]} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: /수정/ }));
    expect(onEdit).toHaveBeenCalledWith(MEMO_1);
  });

  it('삭제 버튼 클릭 → onDelete(memo_id) 호출', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderWithProviders(<MemoList {...DEFAULT_PROPS} items={[MEMO_1]} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /삭제/ }));
    expect(onDelete).toHaveBeenCalledWith('memo-1');
  });
});
