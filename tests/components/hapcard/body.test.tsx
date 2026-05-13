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

  it('eyebrow "전체 해석" 표시', () => {
    renderWithProviders(<HapcardBody mainText="두 사람의 합은 강합니다." />);
    expect(screen.getByText('전체 해석')).toBeInTheDocument();
  });

  it('main_text 표시', () => {
    renderWithProviders(<HapcardBody mainText="두 사람의 합은 강합니다." />);
    expect(screen.getByText('두 사람의 합은 강합니다.')).toBeInTheDocument();
  });

  it('한자 포함 텍스트에서 한자를 DOM에 노출하지 않는다', () => {
    const { container } = renderWithProviders(
      <HapcardBody mainText="재성(財星)이 왕한 구조입니다." />
    );
    expect(container.textContent).not.toMatch(/[一-鿿]/);
  });
});
