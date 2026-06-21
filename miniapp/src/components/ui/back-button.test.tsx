import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { BackButton } from './back-button';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('BackButton', () => {
  it('기본 aria-label 은 "뒤로"', () => {
    renderWithProviders(<BackButton />);
    expect(screen.getByRole('button', { name: '뒤로' })).toBeTruthy();
  });

  it('커스텀 aria-label 을 적용한다', () => {
    renderWithProviders(<BackButton ariaLabel="이전 단계" />);
    expect(screen.getByRole('button', { name: '이전 단계' })).toBeTruthy();
  });

  it('lucide ChevronLeft 글리프를 렌더한다', () => {
    const { container } = renderWithProviders(<BackButton />);
    expect(container.querySelector('.lucide-chevron-left')).toBeTruthy();
  });

  it('onClick 제공 시 클릭하면 그 콜백을 호출한다', () => {
    const onClick = vi.fn();
    renderWithProviders(<BackButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('onClick 미제공 시 클릭하면 navigate(-1) 한다', () => {
    mockNavigate.mockClear();
    renderWithProviders(<BackButton />);
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('히트 영역은 44pt 이상이다(a11y 타깃)', () => {
    renderWithProviders(<BackButton />);
    const btn = screen.getByRole('button', { name: '뒤로' });
    expect(btn.style.width).toBe('44px');
    expect(btn.style.height).toBe('44px');
  });
});
