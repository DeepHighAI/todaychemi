// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardBody } from '@/components/hapcard/body';

describe('HapcardBody', () => {
  it('data-testid="hapcard-body" 렌더', () => {
    renderWithProviders(<HapcardBody mainText="두 사람의 합은 강합니다." />);
    expect(document.querySelector('[data-testid="hapcard-body"]')).not.toBeNull();
  });

  it('eyebrow "한 줄 결론" 표시', () => {
    renderWithProviders(<HapcardBody mainText="두 사람의 합은 강합니다." />);
    expect(screen.getByText('한 줄 결론')).toBeInTheDocument();
  });

  it('main_text 표시', () => {
    renderWithProviders(<HapcardBody mainText="두 사람의 합은 강합니다." />);
    expect(screen.getByText('두 사람의 합은 강합니다.')).toBeInTheDocument();
  });
});
