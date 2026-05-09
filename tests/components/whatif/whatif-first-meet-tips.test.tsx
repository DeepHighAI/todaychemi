// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { WhatifFirstMeetTips } from '@/components/whatif/whatif-first-meet-tips';

const MOCK_TIPS: [string, string, string] = [
  '첫 인상에 집중하기',
  '자연스럽게 대화 시작하기',
  '공통 관심사 찾기',
];

describe('WhatifFirstMeetTips', () => {
  it('data-testid="whatif-first-meet-tips" 렌더', () => {
    renderWithProviders(<WhatifFirstMeetTips tips={MOCK_TIPS} />);
    expect(document.querySelector('[data-testid="whatif-first-meet-tips"]')).not.toBeNull();
  });

  it('헤더 "첫 만남 TIP" 표시', () => {
    renderWithProviders(<WhatifFirstMeetTips tips={MOCK_TIPS} />);
    expect(screen.getByText('첫 만남 TIP')).toBeInTheDocument();
  });

  it('번호(1·2·3) + 3개 tip 텍스트 노출', () => {
    renderWithProviders(<WhatifFirstMeetTips tips={MOCK_TIPS} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    for (const tip of MOCK_TIPS) {
      expect(screen.getByText(tip)).toBeInTheDocument();
    }
  });
});
