import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { TimeWheelField } from './time-wheel-field';

const BASE = { label: '태어난 시간', placeholder: '선택' };

describe('TimeWheelField', () => {
  it('값을 HH:MM 으로 표시하고 시/분 휠을 연다', () => {
    renderWithProviders(<TimeWheelField value="03:40" onChange={vi.fn()} {...BASE} />);
    expect(screen.getByText('03:40')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '태어난 시간' }));
    expect(screen.getByRole('listbox', { name: '시' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: '분' })).toBeInTheDocument();
  });

  it('시 선택 후 완료 시 HH:MM 으로 onChange 한다', () => {
    const onChange = vi.fn();
    renderWithProviders(<TimeWheelField value="03:40" onChange={onChange} {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: '태어난 시간' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: '시' })).getByText('09'));
    fireEvent.click(screen.getByText('완료'));
    expect(onChange).toHaveBeenCalledWith('09:40');
  });

  it('닫기 시 onChange 를 호출하지 않는다', () => {
    const onChange = vi.fn();
    renderWithProviders(<TimeWheelField value="03:40" onChange={onChange} {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: '태어난 시간' }));
    fireEvent.click(screen.getByText('닫기'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('빈 값이면 placeholder 를 표시한다', () => {
    renderWithProviders(<TimeWheelField value="" onChange={vi.fn()} {...BASE} />);
    expect(screen.getByText('선택')).toBeInTheDocument();
  });
});
