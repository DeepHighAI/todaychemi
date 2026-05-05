// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TermTooltip } from '@/components/hapcard/primitives/term-tooltip';

describe('TermTooltip', () => {
  it('등록된 용어는 trigger data-testid 렌더', () => {
    render(<TermTooltip term="일주">일주</TermTooltip>);
    expect(screen.getByTestId('term-tooltip-trigger')).toBeInTheDocument();
  });

  it('미등록 용어는 plain span, trigger 없음', () => {
    render(<TermTooltip term="모르는용어">모르는용어</TermTooltip>);
    expect(screen.queryByTestId('term-tooltip-trigger')).toBeNull();
    expect(screen.getByText('모르는용어')).toBeInTheDocument();
  });

  it('trigger에 tabIndex=0 (키보드 내비게이션)', () => {
    render(<TermTooltip term="충">충</TermTooltip>);
    const trigger = screen.getByTestId('term-tooltip-trigger');
    expect(trigger).toHaveAttribute('tabIndex', '0');
  });

  it('defaultOpen 시 정의 텍스트 노출', () => {
    render(<TermTooltip term="합" defaultOpen>합</TermTooltip>);
    expect(screen.getByText(/천간합/)).toBeInTheDocument();
  });
});
