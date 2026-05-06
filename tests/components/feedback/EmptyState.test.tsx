// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { EmptyState } from '@/components/feedback/EmptyState';

describe('EmptyState', () => {
  it('data-testid="empty-state" 렌더', () => {
    renderWithProviders(<EmptyState title="첫 인연을 기록해보세요" />);
    expect(document.querySelector('[data-testid="empty-state"]')).not.toBeNull();
  });

  it('title prop 표시', () => {
    renderWithProviders(<EmptyState title="첫 인연을 기록해보세요" />);
    expect(screen.getByText('첫 인연을 기록해보세요')).toBeInTheDocument();
  });

  it('body prop 표시', () => {
    renderWithProviders(
      <EmptyState
        title="첫 인연을 기록해보세요"
        body="첫 합보기 1회 + 내일 다시합 1회가 무료로 준비되어 있어요"
      />,
    );
    expect(
      screen.getByText('첫 합보기 1회 + 내일 다시합 1회가 무료로 준비되어 있어요'),
    ).toBeInTheDocument();
  });

  it('cta + onCta 있으면 버튼 표시', () => {
    renderWithProviders(
      <EmptyState title="첫 인연을 기록해보세요" cta="+ 인연 등록" onCta={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: '+ 인연 등록' })).toBeInTheDocument();
  });

  it('onCta 없으면 CTA 버튼 숨김', () => {
    renderWithProviders(<EmptyState title="첫 인연을 기록해보세요" cta="+ 인연 등록" />);
    expect(screen.queryByRole('button', { name: '+ 인연 등록' })).toBeNull();
  });

  it('[CTA] 클릭 → onCta 호출', () => {
    const onCta = vi.fn();
    renderWithProviders(
      <EmptyState title="첫 인연을 기록해보세요" cta="+ 인연 등록" onCta={onCta} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ 인연 등록' }));
    expect(onCta).toHaveBeenCalledOnce();
  });
});
