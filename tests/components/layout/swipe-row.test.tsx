// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import { SwipeRow } from '@/components/layout/swipe-row';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SwipeRow', () => {
  it('자식과 삭제 버튼(aria-label 삭제)을 렌더한다', () => {
    renderWithIntl(
      <SwipeRow onDelete={vi.fn()} onClick={vi.fn()}>
        <div>인연 카드</div>
      </SwipeRow>,
    );
    expect(screen.getByText('인연 카드')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('삭제 버튼 클릭이 onDelete를 호출한다', () => {
    const onDelete = vi.fn();
    renderWithIntl(
      <SwipeRow onDelete={onDelete} onClick={vi.fn()}>
        <div>인연 카드</div>
      </SwipeRow>,
    );
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('드래그 없이 행을 클릭하면 onClick을 호출한다', () => {
    const onClick = vi.fn();
    renderWithIntl(
      <SwipeRow onClick={onClick}>
        <div>인연 카드</div>
      </SwipeRow>,
    );
    fireEvent.click(screen.getByText('인연 카드'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Enter 키로 행을 활성화하면 onClick을 호출한다', () => {
    const onClick = vi.fn();
    renderWithIntl(
      <SwipeRow onClick={onClick}>
        <div>인연 카드</div>
      </SwipeRow>,
    );
    const row = screen.getByRole('button', { name: /인연 카드/ });
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('가로로 드래그한 뒤의 클릭은 onClick을 억제한다', () => {
    const onClick = vi.fn();
    renderWithIntl(
      <SwipeRow onClick={onClick}>
        <div>인연 카드</div>
      </SwipeRow>,
    );
    const row = screen.getByRole('button', { name: /인연 카드/ });
    fireEvent.mouseDown(row, { clientX: 200, clientY: 10 });
    fireEvent.mouseMove(row, { clientX: 120, clientY: 12 });
    fireEvent.mouseUp(row);
    fireEvent.click(row);
    expect(onClick).not.toHaveBeenCalled();
  });
});
