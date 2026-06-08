// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardFooter } from '@/components/hapcard/footer';

describe('HapcardFooter', () => {
  it('data-testid="hapcard-footer" 렌더', () => {
    renderWithProviders(<HapcardFooter />);
    expect(document.querySelector('[data-testid="hapcard-footer"]')).not.toBeNull();
  });

  it('면책 카피 표시', () => {
    renderWithProviders(<HapcardFooter />);
    expect(
      screen.getByText('본 콘텐츠는 참고용이며, 의료·재정·법적 결정의 근거가 될 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('replayHint 제거됨 — 별도 ReplayButton으로 대체', () => {
    renderWithProviders(<HapcardFooter />);
    expect(
      screen.queryByText('D+1 케미 다시 맞추기 알림은 다음 단계에서 설정할 수 있어요.'),
    ).not.toBeInTheDocument();
  });
});
