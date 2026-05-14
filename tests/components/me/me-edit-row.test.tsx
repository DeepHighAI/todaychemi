// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { MeEditRow } from '@/components/me/me-edit-row';

describe('MeEditRow', () => {
  it('"내 정보 수정" 타이틀 렌더', () => {
    renderWithProviders(<MeEditRow onClick={vi.fn()} />);
    expect(screen.getByText('내 정보 수정')).toBeInTheDocument();
  });

  it('클릭 시 onClick 콜백 호출', () => {
    const onClick = vi.fn();
    renderWithProviders(<MeEditRow onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
