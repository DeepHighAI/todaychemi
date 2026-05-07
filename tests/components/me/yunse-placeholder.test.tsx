// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { YunsePlaceholder } from '@/components/me/yunse-placeholder';

describe('YunsePlaceholder', () => {
  it('title "운세 흐름" 렌더', () => {
    renderWithProviders(<YunsePlaceholder />);
    expect(screen.getByText('운세 흐름')).toBeInTheDocument();
  });

  it('body "타임라인 해석..." 렌더', () => {
    renderWithProviders(<YunsePlaceholder />);
    expect(screen.getByText('타임라인 해석은 합카드 다시합과 함께 다음 업데이트에 공개돼요.')).toBeInTheDocument();
  });

  it('data-testid="yunse-placeholder" 존재', () => {
    renderWithProviders(<YunsePlaceholder />);
    expect(screen.getByTestId('yunse-placeholder')).toBeInTheDocument();
  });
});
