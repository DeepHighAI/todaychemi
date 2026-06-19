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
  };

  it('회사소개(외부 링크) 행을 렌더하지 않는다', () => {
    renderWithProviders(<InfoCard {...baseProps} />);
    expect(screen.queryByText('회사소개')).not.toBeInTheDocument();
  });

  // 미니앱은 토스 자동 로그인이라 수동 로그아웃이 불필요 — 행을 제거한다.
  it('로그아웃 행을 렌더하지 않는다 (미니앱)', () => {
    renderWithProviders(<InfoCard {...baseProps} />);
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
  });

  it('남은 정보 행은 5개다 (언어·개인정보·약관·환불·계정삭제)', () => {
    renderWithProviders(<InfoCard {...baseProps} />);
    const card = screen.getByTestId('info-card');
    expect(within(card).getAllByRole('button')).toHaveLength(5);
  });
});
