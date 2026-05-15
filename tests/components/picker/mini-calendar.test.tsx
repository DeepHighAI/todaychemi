// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

import { renderWithIntl } from '../../utils/render-with-intl';
import { MiniCalendar } from '../../../src/components/picker/mini-calendar';

function mk(overrides: Partial<Parameters<typeof MiniCalendar>[0]> = {}) {
  return {
    year: 2024, month: 10 /* Nov 2024 */, day: -1,
    onSelect: vi.fn(), onMonthChange: vi.fn(), onLabelTap: vi.fn(),
    ...overrides,
  };
}

describe('MiniCalendar', () => {
  it('renders 7 localized weekday headers', () => {
    renderWithIntl(<MiniCalendar {...mk()} />);
    const headers = document.querySelectorAll('.cal .h');
    expect(headers).toHaveLength(7);
    expect(headers[0].textContent).toBe('일');
    expect(headers[6].textContent).toBe('토');
  });

  it('renders 42 cells total', () => {
    renderWithIntl(<MiniCalendar {...mk()} />);
    expect(document.querySelectorAll('.cal .d')).toHaveLength(42);
  });

  it('has correct number of leading muted cells for Nov 2024', () => {
    renderWithIntl(<MiniCalendar {...mk()} />);
    // Nov 1 2024 = Friday → 5 leading nulls
    const muted = document.querySelectorAll('.cal .d.muted');
    const firstSix = Array.from(muted).slice(0, 5);
    expect(firstSix).toHaveLength(5);
  });

  it('renders 29 day cells for Feb 2024 (leap year)', () => {
    renderWithIntl(<MiniCalendar {...mk({ year: 2024, month: 1 })} />);
    const days = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).filter(el => el.textContent?.trim());
    expect(days).toHaveLength(29);
  });

  it('renders 28 day cells for Feb 2023 (non-leap)', () => {
    renderWithIntl(<MiniCalendar {...mk({ year: 2023, month: 1 })} />);
    const days = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).filter(el => el.textContent?.trim());
    expect(days).toHaveLength(28);
  });

  it('marks selected day with sel class', () => {
    renderWithIntl(<MiniCalendar {...mk({ day: 15 })} />);
    expect(screen.getByText('15').className).toContain('sel');
  });

  it('shows no sel when day=-1', () => {
    renderWithIntl(<MiniCalendar {...mk({ day: -1 })} />);
    expect(document.querySelector('.cal .d.sel')).toBeNull();
  });

  it('calls onSelect with the day number on click', () => {
    const onSelect = vi.fn();
    renderWithIntl(<MiniCalendar {...mk({ onSelect })} />);
    const day10 = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).find(el => el.textContent === '10') as HTMLElement;
    fireEvent.click(day10);
    expect(onSelect).toHaveBeenCalledWith(10);
  });

  it('calls onMonthChange(-1) on back arrow', () => {
    const onMonthChange = vi.fn();
    renderWithIntl(<MiniCalendar {...mk({ onMonthChange })} />);
    fireEvent.click(screen.getByText('‹'));
    expect(onMonthChange).toHaveBeenCalledWith(-1);
  });

  it('calls onMonthChange(1) on forward arrow', () => {
    const onMonthChange = vi.fn();
    renderWithIntl(<MiniCalendar {...mk({ onMonthChange })} />);
    fireEvent.click(screen.getByText('›'));
    expect(onMonthChange).toHaveBeenCalledWith(1);
  });

  it('calls onLabelTap when the month label button is clicked', () => {
    const onLabelTap = vi.fn();
    renderWithIntl(<MiniCalendar {...mk({ onLabelTap })} />);
    fireEvent.click(screen.getByText('2024년 11월'));
    expect(onLabelTap).toHaveBeenCalledOnce();
  });
});
