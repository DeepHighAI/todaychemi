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
});
