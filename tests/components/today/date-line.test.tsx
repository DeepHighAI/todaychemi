// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { DateLine } from '@/components/today/date-line';

describe('DateLine', () => {
  it('날짜 문자열을 그대로 렌더한다', () => {
    render(<DateLine date="2026.05.06" dayPillar="갑자" />);
    expect(screen.getByText('2026.05.06')).toBeInTheDocument();
  });

  it('일주에 "일" 접미사를 붙여 렌더한다', () => {
    render(<DateLine date="2026.05.06" dayPillar="갑자" />);
    expect(screen.getByText('갑자일')).toBeInTheDocument();
  });

  it('한자 dayPillar(丙寅)를 한글 reading(병인)으로 렌더 (ADR-038)', () => {
    render(<DateLine date="2026.05.14" dayPillar="丙寅" />);
    expect(screen.getByText('병인일')).toBeInTheDocument();
    expect(screen.queryByText('丙寅일')).not.toBeInTheDocument();
  });
});
