// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardConclusion } from '@/components/hapcard/conclusion';

describe('HapcardConclusion', () => {
  it('첫 문장을 h2로 렌더링', () => {
    renderWithProviders(<HapcardConclusion mainText="두 사람의 인연은 깊다. 서로를 이해하며 성장한다." />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('두 사람의 인연은 깊다.');
  });

  it('eyebrow "한 줄 결론" 표시', () => {
    renderWithProviders(<HapcardConclusion mainText="짧은 결론이다." />);
    expect(screen.getByTestId('conclusion-eyebrow')).toBeInTheDocument();
  });

  it('구분자 없는 텍스트는 전체를 h2에 표시', () => {
    renderWithProviders(<HapcardConclusion mainText="짧은 텍스트" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('짧은 텍스트');
  });

  it('한자 포함 텍스트에서 한자를 DOM에 노출하지 않는다', () => {
    const { container } = renderWithProviders(
      <HapcardConclusion mainText="木火土 기운이 강한 인연입니다." />
    );
    expect(container.textContent).not.toMatch(/[一-鿿]/);
  });
});
