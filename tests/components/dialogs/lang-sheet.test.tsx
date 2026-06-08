// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import { LangSheet } from '@/components/dialogs/lang-sheet';

describe('LangSheet', () => {
  it('open=true면 언어 목록과 닫기 버튼을 보여준다', () => {
    renderWithIntl(<LangSheet open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('언어 변경')).toBeInTheDocument();
    expect(screen.getByText('한국어')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Tiếng Việt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
  });

  it('한국어만 선택 가능하고 준비 중 언어는 비활성화된다', () => {
    renderWithIntl(<LangSheet open={true} onOpenChange={vi.fn()} />);

    const koButton = screen.getByText('한국어').closest('button')!;
    expect(koButton).not.toBeDisabled();

    // 언어 선택 버튼(닫기 제외) 중 준비 중 2개는 비활성화
    const langButtons = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-label') !== '닫기');
    const disabled = langButtons.filter((button) => (button as HTMLButtonElement).disabled);
    expect(disabled).toHaveLength(2);
  });

  it('open=false면 시트를 렌더하지 않는다', () => {
    renderWithIntl(<LangSheet open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('언어 변경')).not.toBeInTheDocument();
  });
});
