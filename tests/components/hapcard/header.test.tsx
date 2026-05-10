// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardHeader } from '@/components/hapcard/header';

describe('HapcardHeader', () => {
  const defaultProps = {
    mode: '친구합',
    userPillar: '갑인',
    userElement: '목' as const,
    relationPillar: '병오',
    relationElement: '화' as const,
  };

  it('data-testid="hapcard-header" 렌더', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(document.querySelector('[data-testid="hapcard-header"]')).not.toBeNull();
  });

  it('본인 일주 텍스트(갑인) 표시', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(screen.getByText('갑인')).toBeInTheDocument();
  });

  it('인연 일주 텍스트(병오) 표시', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(screen.getByText('병오')).toBeInTheDocument();
  });

  it('mode 라벨 표시 (친구합)', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(screen.getByText('친구합')).toBeInTheDocument();
  });

  it('nickname 미전달 시 기존 렌더 회귀 없음', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(screen.getByText('갑인')).toBeInTheDocument();
    expect(screen.getByText('병오')).toBeInTheDocument();
    expect(screen.queryByTestId('hapcard-header-nickname')).toBeNull();
  });

  it('nickname 전달 시 헤더 영역 내부에 1회 노출', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} nickname="별이" />);
    const nicknameEl = screen.getByTestId('hapcard-header-nickname');
    expect(nicknameEl).toBeInTheDocument();
    expect(nicknameEl.textContent).toBe('별이');
    expect(
      document.querySelector('[data-testid="hapcard-header"]')
    ).toContainElement(nicknameEl);
  });

  it('닉네임은 mode 텍스트와 별개 DOM 노드', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} nickname="별이" />);
    const nicknameEl = screen.getByTestId('hapcard-header-nickname');
    const modeEl = screen.getByText('친구합');
    expect(nicknameEl).not.toBe(modeEl);
  });
});
