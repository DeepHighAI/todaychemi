// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import { AboutDialog } from '@/components/dialogs/about-dialog';

describe('AboutDialog', () => {
  it('open=true면 서비스명·소개·회사 정보를 보여준다', () => {
    renderWithIntl(<AboutDialog open={true} onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('오늘케미')).toBeInTheDocument();
    expect(screen.getByText(/관계 사주 서비스/)).toBeInTheDocument();
    expect(screen.getByText('(주) 딥하이')).toBeInTheDocument();
    expect(screen.getByText('798-86-01094')).toBeInTheDocument();
    expect(screen.getByText('심충섭')).toBeInTheDocument();
  });

  it('open=false면 다이얼로그를 렌더하지 않는다', () => {
    renderWithIntl(<AboutDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('(주) 딥하이')).not.toBeInTheDocument();
  });
});
