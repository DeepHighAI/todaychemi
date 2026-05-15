// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { WheelPicker } from '../../../src/components/picker/wheel-picker';

const OPTIONS = ['00', '01', '02', '03'];

describe('WheelPicker', () => {
  it('renders all options as role=button', () => {
    const { getAllByRole } = render(<WheelPicker options={OPTIONS} value="01" onChange={vi.fn()} />);
    expect(getAllByRole('button')).toHaveLength(4);
  });

  it('marks the current value with sel class', () => {
    const { getByText } = render(<WheelPicker options={OPTIONS} value="02" onChange={vi.fn()} />);
    expect(getByText('02').className).toContain('sel');
    expect(getByText('00').className).not.toContain('sel');
  });

  it('calls onChange on click', () => {
    const onChange = vi.fn();
    const { getByText } = render(<WheelPicker options={OPTIONS} value="00" onChange={onChange} />);
    fireEvent.click(getByText('03'));
    expect(onChange).toHaveBeenCalledWith('03');
  });

  it('calls onChange on Enter keydown', () => {
    const onChange = vi.fn();
    const { getByText } = render(<WheelPicker options={OPTIONS} value="00" onChange={onChange} />);
    fireEvent.keyDown(getByText('02'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('02');
  });

  // jsdom does not fire scroll events on programmatic scrollTop set — test the onScroll branch directly
  it('calls onChange on scroll event', () => {
    const onChange = vi.fn();
    const { container } = render(<WheelPicker options={OPTIONS} value="00" onChange={onChange} />);
    const col = container.querySelector('.picker-col')!;
    Object.defineProperty(col, 'scrollTop', { value: 80, configurable: true });
    fireEvent.scroll(col);
    expect(onChange).toHaveBeenCalledWith('02');
  });

  it('passes aria-label to the column element', () => {
    const { container } = render(<WheelPicker options={OPTIONS} value="00" onChange={vi.fn()} aria-label="시" />);
    expect(container.querySelector('[aria-label="시"]')).toBeTruthy();
  });
});
