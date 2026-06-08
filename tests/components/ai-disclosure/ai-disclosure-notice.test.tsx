// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import { AiDisclosureNotice } from '@/components/ai-disclosure/ai-disclosure-notice';

describe('AiDisclosureNotice', () => {
  it('고지 제목 "AI가 만든 해석이에요" 를 렌더한다', () => {
    renderWithIntl(<AiDisclosureNotice />);
    expect(screen.getByText('AI가 만든 해석이에요')).toBeInTheDocument();
  });

  it('고지 본문(AI 생성 안내)을 렌더한다', () => {
    renderWithIntl(<AiDisclosureNotice />);
    expect(screen.getByText(/AI가 사주 데이터를 바탕으로 생성/)).toBeInTheDocument();
  });

  it('AI 생성 배지를 포함한다', () => {
    renderWithIntl(<AiDisclosureNotice />);
    expect(screen.getByTestId('ai-disclosure-badge')).toBeInTheDocument();
  });

  it('data-testid="ai-disclosure-notice" 를 노출한다', () => {
    renderWithIntl(<AiDisclosureNotice />);
    expect(screen.getByTestId('ai-disclosure-notice')).toBeInTheDocument();
  });
});
