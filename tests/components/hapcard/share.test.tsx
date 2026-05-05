// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardShare } from '@/components/hapcard/share';

describe('HapcardShare', () => {
  it('data-testid="hapcard-share" 렌더', () => {
    renderWithProviders(<HapcardShare />);
    expect(document.querySelector('[data-testid="hapcard-share"]')).not.toBeNull();
  });

  it('"공유합카드 만들기" 버튼 표시', () => {
    renderWithProviders(<HapcardShare />);
    expect(screen.getByRole('button', { name: '공유합카드 만들기' })).toBeInTheDocument();
  });
});
