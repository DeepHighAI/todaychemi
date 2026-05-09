// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { WhatifDoFirst } from '@/components/whatif/whatif-do-first';

const MOCK_ITEMS: [string, string, string] = [
  '목표 설정하기',
  '우선순위 정하기',
  '작은 것부터 시작',
];

describe('WhatifDoFirst', () => {
  it('data-testid="whatif-do-first" 렌더', () => {
    renderWithProviders(<WhatifDoFirst items={MOCK_ITEMS} />);
    expect(document.querySelector('[data-testid="whatif-do-first"]')).not.toBeNull();
  });

  it('헤더 "일단 이거 해봐" 표시', () => {
    renderWithProviders(<WhatifDoFirst items={MOCK_ITEMS} />);
    expect(screen.getByText('일단 이거 해봐')).toBeInTheDocument();
  });

  it('번호(1·2·3) + 3개 항목 텍스트 노출', () => {
    renderWithProviders(<WhatifDoFirst items={MOCK_ITEMS} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    for (const item of MOCK_ITEMS) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });
});
