// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { QuickAddRelation } from '@/components/today/quick-add-relation';

describe('QuickAddRelation', () => {
  it('/relations/new 링크를 렌더한다', () => {
    renderWithProviders(<QuickAddRelation />);
    const link = screen.getByRole('link', { name: /인연 등록/ });
    expect(link).toHaveAttribute('href', '/relations/new');
  });

  it('링크 내부에 svg 아이콘이 있다', () => {
    renderWithProviders(<QuickAddRelation />);
    const link = screen.getByRole('link', { name: /인연 등록/ });
    expect(link.querySelector('svg')).toBeTruthy();
  });
});
