// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { WhatifHero } from '@/components/whatif/whatif-hero';

describe('WhatifHero', () => {
  it('data-testid="whatif-hero" 렌더', () => {
    renderWithProviders(<WhatifHero type="work" body="테스트 본문입니다." />);
    expect(document.querySelector('[data-testid="whatif-hero"]')).not.toBeNull();
  });

  it('type="work" → whatif.card.work.title "일할 때 나" 표시', () => {
    renderWithProviders(<WhatifHero type="work" body="테스트 본문입니다." />);
    expect(screen.getByText('일할 때 나')).toBeInTheDocument();
  });

  it('body 문자열을 노출한다', () => {
    renderWithProviders(<WhatifHero type="work" body="이것은 본문 텍스트입니다." />);
    expect(screen.getByText('이것은 본문 텍스트입니다.')).toBeInTheDocument();
  });

  it('body의 한자를 한글로 변환한다 (ADR-038)', () => {
    renderWithProviders(<WhatifHero type="work" body="戊申 일간으로서 土의 안정감이 강해요." />);
    expect(screen.getByText('무신 일간으로서 토의 안정감이 강해요.')).toBeInTheDocument();
    expect(screen.queryByText(/戊申|土/)).not.toBeInTheDocument();
  });
});
