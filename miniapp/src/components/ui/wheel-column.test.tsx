import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { WheelColumn } from './wheel-column';

describe('WheelColumn', () => {
  it('옵션 클릭 시 해당 값으로 onChange 호출', () => {
    const onChange = vi.fn();
    render(<WheelColumn options={['01', '02', '03']} value="01" onChange={onChange} ariaLabel="월" />);
    fireEvent.click(screen.getByText('02'));
    expect(onChange).toHaveBeenCalledWith('02');
  });

  it('선택 옵션에 aria-selected=true, 나머지는 false', () => {
    render(<WheelColumn options={['01', '02']} value="02" onChange={vi.fn()} ariaLabel="월" />);
    expect(screen.getByText('02')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('01')).toHaveAttribute('aria-selected', 'false');
  });

  it('listbox role 과 aria-label 을 부여한다', () => {
    render(<WheelColumn options={['01']} value="01" onChange={vi.fn()} ariaLabel="월" />);
    expect(screen.getByRole('listbox', { name: '월' })).toBeInTheDocument();
  });

  it('ArrowDown/ArrowUp 키로 인접 옵션을 선택한다', () => {
    const onChange = vi.fn();
    render(<WheelColumn options={['01', '02', '03']} value="02" onChange={onChange} ariaLabel="월" />);
    const list = screen.getByRole('listbox', { name: '월' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('03');
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('01');
  });

  it('Home/End 키로 처음/마지막 옵션을 선택한다', () => {
    const onChange = vi.fn();
    render(<WheelColumn options={['01', '02', '03']} value="02" onChange={onChange} ariaLabel="월" />);
    const list = screen.getByRole('listbox', { name: '월' });
    fireEvent.keyDown(list, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('03');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('01');
  });

  it('listbox 가 키보드 포커스 가능(tabIndex 0)하고 aria-activedescendant 를 가리킨다', () => {
    render(<WheelColumn options={['01', '02']} value="02" onChange={vi.fn()} ariaLabel="월" />);
    const list = screen.getByRole('listbox', { name: '월' });
    expect(list).toHaveAttribute('tabindex', '0');
    const active = list.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)).toHaveTextContent('02');
  });
});
