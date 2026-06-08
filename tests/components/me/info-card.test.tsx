// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import { InfoCard } from '@/components/me/info-card';

function makeProps(overrides: Partial<Parameters<typeof InfoCard>[0]> = {}) {
  return {
    onPrivacy: vi.fn(),
    onTerms: vi.fn(),
    onAbout: vi.fn(),
    onLang: vi.fn(),
    onDeleteAccount: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InfoCard', () => {
  it('서비스 정보 행 라벨을 모두 렌더한다', () => {
    renderWithIntl(<InfoCard {...makeProps()} />);

    expect(screen.getByText('서비스 정보')).toBeInTheDocument();
    expect(screen.getByText('언어 변경')).toBeInTheDocument();
    expect(screen.getByText('개인정보처리방침')).toBeInTheDocument();
    expect(screen.getByText('이용약관')).toBeInTheDocument();
    expect(screen.getByText('내 데이터 내려받기')).toBeInTheDocument();
    expect(screen.getByText('계정 삭제 요청')).toBeInTheDocument();
    expect(screen.getByText('회사소개')).toBeInTheDocument();
    expect(screen.getByText('로그아웃')).toBeInTheDocument();
  });

  it('각 행 클릭이 대응하는 콜백을 호출한다', () => {
    const props = makeProps();
    renderWithIntl(<InfoCard {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /언어 변경/ }));
    expect(props.onLang).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /개인정보처리방침/ }));
    expect(props.onPrivacy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /이용약관/ }));
    expect(props.onTerms).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /회사소개/ }));
    expect(props.onAbout).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /계정 삭제 요청/ }));
    expect(props.onDeleteAccount).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });

  it('데이터 내려받기·대표번호는 링크(href)로 렌더한다', () => {
    renderWithIntl(<InfoCard {...makeProps()} />);

    expect(screen.getByRole('link', { name: /내 데이터 내려받기/ })).toHaveAttribute('href', '/api/me/export');
    expect(screen.getByRole('link', { name: /대표번호/ })).toHaveAttribute('href', 'tel:0234431028');
  });

  it('logoutLoading=true면 로그아웃 버튼이 비활성화되고 로딩 문구를 보여준다', () => {
    renderWithIntl(<InfoCard {...makeProps({ logoutLoading: true })} />);

    const logout = screen.getByRole('button', { name: /로그아웃/ });
    expect(logout).toBeDisabled();
    expect(screen.getByText('로그아웃 중…')).toBeInTheDocument();
  });
});
