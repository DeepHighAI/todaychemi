import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { PickerField } from './picker-field';

describe('PickerField', () => {
  it('값이 있으면 값을, 없으면 placeholder 를 표시한다', () => {
    const { rerender } = render(
      <PickerField value="1994.09.12" placeholder="선택" ariaLabel="생년월일" onTap={vi.fn()} />,
    );
    expect(screen.getByText('1994.09.12')).toBeInTheDocument();
    rerender(<PickerField value="" placeholder="선택" ariaLabel="생년월일" onTap={vi.fn()} />);
    expect(screen.getByText('선택')).toBeInTheDocument();
  });

  it('탭하면 onTap 을 호출하고 aria-label 을 부여한다', () => {
    const onTap = vi.fn();
    render(<PickerField value="" placeholder="선택" ariaLabel="생년월일" onTap={onTap} />);
    fireEvent.click(screen.getByRole('button', { name: '생년월일' }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
