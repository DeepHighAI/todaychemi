// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import { AiDisclosureBadge } from '@/components/ai-disclosure/ai-disclosure-badge';

describe('AiDisclosureBadge', () => {
  it('"AI 생성" 라벨을 렌더한다', () => {
    renderWithIntl(<AiDisclosureBadge />);
    expect(screen.getByText('AI 생성')).toBeInTheDocument();
  });

  it('data-testid="ai-disclosure-badge" 를 노출한다', () => {
    renderWithIntl(<AiDisclosureBadge />);
    expect(screen.getByTestId('ai-disclosure-badge')).toBeInTheDocument();
  });

  it('tone="dark" 면 어두운(liquid hero) 배경용 흰 글씨 스타일을 적용한다', () => {
    renderWithIntl(<AiDisclosureBadge tone="dark" />);
    expect(screen.getByTestId('ai-disclosure-badge').className).toContain('text-white');
  });

  it('tone 미지정(기본 light) 이면 밝은 카드용 스타일을 적용한다', () => {
    renderWithIntl(<AiDisclosureBadge />);
    expect(screen.getByTestId('ai-disclosure-badge').className).toContain('text-secondary-foreground');
  });
});
