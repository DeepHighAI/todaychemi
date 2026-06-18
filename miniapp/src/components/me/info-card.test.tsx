import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { InfoCard } from './info-card';

describe('InfoCard', () => {
  const baseProps = {
    onPrivacy: vi.fn(),
    onTerms: vi.fn(),
    onRefund: vi.fn(),
    onLang: vi.fn(),
    onDeleteAccount: vi.fn(),
    onLogout: vi.fn(),
  };

  it('회사소개(외부 링크) 행을 렌더하지 않는다', () => {
    renderWithProviders(<InfoCard {...baseProps} />);
    expect(screen.queryByText('회사소개')).not.toBeInTheDocument();
  });

  it('남은 정보 행은 6개다 (언어·개인정보·약관·환불·계정삭제·로그아웃)', () => {
    renderWithProviders(<InfoCard {...baseProps} />);
    const card = screen.getByTestId('info-card');
    expect(within(card).getAllByRole('button')).toHaveLength(6);
  });
});
