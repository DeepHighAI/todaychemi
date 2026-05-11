// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardHighlights2Up } from '@/components/hapcard/highlights-2up';

describe('HapcardHighlights2Up', () => {
  it('cards 0개일 때 아무것도 렌더링하지 않음', () => {
    const { container } = renderWithProviders(<HapcardHighlights2Up cards={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('cards 1개일 때 강점 카드만 단독 렌더링', () => {
    renderWithProviders(
      <HapcardHighlights2Up
        cards={[{ title: '신뢰가 깊어지는 조합', reason: '서로의 가치관이 닿아있어요' }]}
      />
    );
    expect(screen.getByTestId('hapcard-highlights-strength')).toBeInTheDocument();
    expect(screen.queryByTestId('hapcard-highlights-warning')).toBeNull();
    expect(screen.getByText('강점')).toBeInTheDocument();
    expect(screen.getByText('신뢰가 깊어지는 조합')).toBeInTheDocument();
    expect(screen.getByText('서로의 가치관이 닿아있어요')).toBeInTheDocument();
  });

  it('cards 2개일 때 강점=[0], 주의=[1] 매핑', () => {
    renderWithProviders(
      <HapcardHighlights2Up
        cards={[
          { title: '강점 제목', reason: '강점 이유' },
          { title: '주의 제목', reason: '주의 이유' },
        ]}
      />
    );
    expect(screen.getByTestId('hapcard-highlights-strength')).toHaveTextContent('강점 제목');
    expect(screen.getByTestId('hapcard-highlights-strength')).toHaveTextContent('강점 이유');
    expect(screen.getByTestId('hapcard-highlights-warning')).toHaveTextContent('주의 제목');
    expect(screen.getByTestId('hapcard-highlights-warning')).toHaveTextContent('주의 이유');
    expect(screen.getByText('강점')).toBeInTheDocument();
    expect(screen.getByText('주의')).toBeInTheDocument();
  });

  it('cards 3개 이상일 때 강점=[0], 주의=[len-1], 중간 카드는 무시', () => {
    renderWithProviders(
      <HapcardHighlights2Up
        cards={[
          { title: '첫 카드', reason: '첫 이유' },
          { title: '중간 카드', reason: '중간 이유' },
          { title: '마지막 카드', reason: '마지막 이유' },
        ]}
      />
    );
    expect(screen.getByTestId('hapcard-highlights-strength')).toHaveTextContent('첫 카드');
    expect(screen.getByTestId('hapcard-highlights-warning')).toHaveTextContent('마지막 카드');
    expect(screen.queryByText('중간 카드')).toBeNull();
    expect(screen.queryByText('중간 이유')).toBeNull();
  });

  it('한자 포함 텍스트에서 한자를 DOM에 노출하지 않는다', () => {
    const { container } = renderWithProviders(
      <HapcardHighlights2Up
        cards={[
          { title: '자오충(子午沖)', reason: '일지가 충돌합니다' },
          { title: '금수(金水) 조화', reason: '에너지가 균형잡혀요' },
        ]}
      />
    );
    expect(container.textContent).not.toMatch(/[一-鿿]/);
  });
});
