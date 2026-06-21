import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { DateWheelField } from './date-wheel-field';

const BASE = {
  min: '1900-01-01',
  max: '2026-12-31',
  label: '생년월일',
  placeholder: '선택',
};

describe('DateWheelField', () => {
  it('값을 점 구분 형식으로 필드에 표시한다', () => {
    renderWithProviders(<DateWheelField value="1994-09-12" onChange={vi.fn()} {...BASE} />);
    expect(screen.getByText('1994.09.12')).toBeInTheDocument();
  });

  it('탭하면 연/월/일 휠 트레이가 열린다', () => {
    renderWithProviders(<DateWheelField value="1994-09-12" onChange={vi.fn()} {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: '생년월일' }));
    expect(screen.getByRole('listbox', { name: '년' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: '월' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: '일' })).toBeInTheDocument();
  });

  it('월 선택 후 완료 시 YYYY-MM-DD 로 onChange 한다', () => {
    const onChange = vi.fn();
    renderWithProviders(<DateWheelField value="1994-09-12" onChange={onChange} {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: '생년월일' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: '월' })).getByText('03'));
    fireEvent.click(screen.getByText('완료'));
    expect(onChange).toHaveBeenCalledWith('1994-03-12');
  });

  it('평년 2월로 바꾸면 31일이 28일로 보정되어 출력된다', () => {
    const onChange = vi.fn();
    renderWithProviders(<DateWheelField value="2023-01-31" onChange={onChange} {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: '생년월일' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: '월' })).getByText('02'));
    fireEvent.click(screen.getByText('완료'));
    expect(onChange).toHaveBeenCalledWith('2023-02-28');
  });

  it('취소 시 onChange 를 호출하지 않는다', () => {
    const onChange = vi.fn();
    renderWithProviders(<DateWheelField value="1994-09-12" onChange={onChange} {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: '생년월일' }));
    fireEvent.click(screen.getByText('취소'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('빈 값이면 placeholder 를 표시한다', () => {
    renderWithProviders(<DateWheelField value="" onChange={vi.fn()} {...BASE} />);
    expect(screen.getByText('선택')).toBeInTheDocument();
  });
});
