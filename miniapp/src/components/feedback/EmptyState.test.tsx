import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('CTA 버튼에 btn-cta 강조 클래스를 적용한다', () => {
    renderWithProviders(<EmptyState title="제목" cta="시작" onCta={vi.fn()} />);
    expect(screen.getByRole('button', { name: '시작' })).toHaveClass('btn-cta');
  });

  it('CTA 가 없으면 버튼을 렌더하지 않는다', () => {
    renderWithProviders(<EmptyState title="제목" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
