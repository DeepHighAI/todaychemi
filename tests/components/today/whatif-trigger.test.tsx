// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { WhatifTrigger } from '@/components/today/whatif-trigger';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));
import { useRouter } from 'next/navigation';

const mockPush = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never);
});

describe('WhatifTrigger', () => {
  it('트리거 버튼 라벨 = "오늘의 나는?"', () => {
    renderWithProviders(<WhatifTrigger />);
    expect(screen.getByRole('button', { name: '오늘의 나는?' })).toBeInTheDocument();
  });

  it('초기 상태: WhatifSheet 미노출', () => {
    renderWithProviders(<WhatifTrigger />);
    expect(screen.queryByRole('heading', { name: '오늘의 나는?' })).toBeNull();
  });

  it('트리거 클릭 → WhatifSheet 노출 ("오늘의 나는?")', () => {
    renderWithProviders(<WhatifTrigger />);
    fireEvent.click(screen.getByRole('button', { name: '오늘의 나는?' }));
    expect(screen.getByRole('heading', { name: '오늘의 나는?' })).toBeInTheDocument();
  });

  it('시트 열린 후 work 행 클릭 → router.push("/whatif/work")', () => {
    renderWithProviders(<WhatifTrigger />);
    fireEvent.click(screen.getByRole('button', { name: '오늘의 나는?' }));
    fireEvent.click(screen.getByTestId('whatif-row-work'));
    expect(mockPush).toHaveBeenCalledWith('/whatif/work');
  });
});
