// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TermTooltip } from '@/components/hapcard/primitives/term-tooltip';
import { GlossaryProvider } from '@/components/hapcard/glossary-provider';
import { GlossarySheet } from '@/components/hapcard/glossary-sheet';
import { renderWithIntl } from '../../../utils/render-with-intl';

describe('TermTooltip', () => {
  it('등록된 용어는 trigger data-testid 렌더', () => {
    renderWithIntl(<TermTooltip term="일주">일주</TermTooltip>);
    expect(screen.getByTestId('term-tooltip-trigger')).toBeInTheDocument();
  });

  it('미등록 용어는 plain span, trigger 없음', () => {
    renderWithIntl(<TermTooltip term="모르는용어">모르는용어</TermTooltip>);
    expect(screen.queryByTestId('term-tooltip-trigger')).toBeNull();
    expect(screen.getByText('모르는용어')).toBeInTheDocument();
  });

  it('trigger에 tabIndex=0 (키보드 내비게이션)', () => {
    renderWithIntl(<TermTooltip term="충">충</TermTooltip>);
    const trigger = screen.getByTestId('term-tooltip-trigger');
    expect(trigger).toHaveAttribute('tabIndex', '0');
  });

  it('defaultOpen 시 정의 텍스트 노출', () => {
    renderWithIntl(<TermTooltip term="합" defaultOpen>합</TermTooltip>);
    expect(screen.getByText(/천간합/)).toBeInTheDocument();
  });

  it('GlossaryProvider 없을 때 "더 알아보기" CTA 렌더 안 됨', () => {
    renderWithIntl(<TermTooltip term="합" defaultOpen>합</TermTooltip>);
    expect(screen.queryByRole('button', { name: /더 알아보기/ })).toBeNull();
  });

  it('GlossaryProvider 안에서 defaultOpen 시 "더 알아보기" CTA 렌더', () => {
    renderWithIntl(
      <GlossaryProvider>
        <TermTooltip term="합" defaultOpen>합</TermTooltip>
        <GlossarySheet />
      </GlossaryProvider>,
    );
    expect(screen.getByRole('button', { name: /더 알아보기/ })).toBeInTheDocument();
  });

  it('"더 알아보기" 클릭 → GlossarySheet dialog 열림', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <GlossaryProvider>
        <TermTooltip term="합" defaultOpen>합</TermTooltip>
        <GlossarySheet />
      </GlossaryProvider>,
    );
    await user.click(screen.getByRole('button', { name: /더 알아보기/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/천간합/).length).toBeGreaterThan(0);
  });
});
