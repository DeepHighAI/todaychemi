// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { WhatifKeywords } from '@/components/whatif/whatif-keywords';

const MOCK_KEYWORDS: [string, string, string, string, string] = [
  '집중',
  '전략',
  '실행',
  '협업',
  '성과',
];

describe('WhatifKeywords', () => {
  it('data-testid="whatif-keywords" 렌더', () => {
    renderWithProviders(<WhatifKeywords keywords={MOCK_KEYWORDS} />);
    expect(document.querySelector('[data-testid="whatif-keywords"]')).not.toBeNull();
  });

  it('헤더 "키워드" 표시', () => {
    renderWithProviders(<WhatifKeywords keywords={MOCK_KEYWORDS} />);
    expect(screen.getByText('키워드')).toBeInTheDocument();
  });

  it('5개 키워드 모두 화면에 노출', () => {
    renderWithProviders(<WhatifKeywords keywords={MOCK_KEYWORDS} />);
    for (const keyword of MOCK_KEYWORDS) {
      expect(screen.getByText(keyword)).toBeInTheDocument();
    }
  });
});
