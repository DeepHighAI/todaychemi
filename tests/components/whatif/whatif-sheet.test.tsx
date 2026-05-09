// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { WhatifSheet } from '@/components/whatif/whatif-sheet';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));
import { useRouter } from 'next/navigation';

const mockPush = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never);
});

describe('WhatifSheet', () => {
  it('open=true 시 시트 제목 "이런건 어때 ✨" 표시', () => {
    renderWithProviders(<WhatifSheet open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('이런건 어때 ✨')).toBeInTheDocument();
  });

  it('정확히 6개 행이 DIAGNOSTIC_TYPE 순서로 렌더', () => {
    renderWithProviders(<WhatifSheet open={true} onOpenChange={vi.fn()} />);
    const rows = screen.getAllByTestId(/^whatif-row-/);
    expect(rows).toHaveLength(6);
    const ids = rows.map((el) => el.getAttribute('data-testid'));
    expect(ids).toEqual([
      'whatif-row-work',
      'whatif-row-love',
      'whatif-row-conflict',
      'whatif-row-leadership',
      'whatif-row-money',
      'whatif-row-first_meet',
    ]);
  });

  it('각 행 라벨 텍스트가 whatif.card.<type>.title 와 일치', () => {
    renderWithProviders(<WhatifSheet open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('whatif-row-work')).toHaveTextContent('일할 때 나');
    expect(screen.getByTestId('whatif-row-love')).toHaveTextContent('연애할 때 나');
    expect(screen.getByTestId('whatif-row-conflict')).toHaveTextContent('싸울 때 나');
    expect(screen.getByTestId('whatif-row-leadership')).toHaveTextContent('리더합');
    expect(screen.getByTestId('whatif-row-money')).toHaveTextContent('돈쓰는 나');
    expect(screen.getByTestId('whatif-row-first_meet')).toHaveTextContent('첫만남 플레이');
  });

  it('work 행 클릭 → router.push("/whatif/work") 호출', () => {
    renderWithProviders(<WhatifSheet open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('whatif-row-work'));
    expect(mockPush).toHaveBeenCalledWith('/whatif/work');
  });

  it('love 행 클릭 → router.push("/whatif/love") 호출', () => {
    renderWithProviders(<WhatifSheet open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('whatif-row-love'));
    expect(mockPush).toHaveBeenCalledWith('/whatif/love');
  });

  it('open=false 시 시트 제목 미렌더', () => {
    renderWithProviders(<WhatifSheet open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('이런건 어때 ✨')).toBeNull();
  });
});
