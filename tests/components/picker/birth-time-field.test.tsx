// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

import { renderWithIntl } from '../../utils/render-with-intl';
import { BirthTimeField } from '../../../src/components/picker/birth-time-field';

describe('BirthTimeField', () => {
  it('shows placeholder when value is empty', () => {
    renderWithIntl(<BirthTimeField value="" onChange={vi.fn()} label="시간 입력" />);
    expect(screen.getByText('탭해서 선택')).toBeTruthy();
  });

  it('shows time value and filled class when set', () => {
    renderWithIntl(<BirthTimeField value="14:30" onChange={vi.fn()} label="시간 입력" />);
    expect(screen.getByText('14:30')).toBeTruthy();
    expect(document.querySelector('.mock-input.filled')).toBeTruthy();
  });

  it('opens tray with picker-cols and picker-colon on tap', () => {
    renderWithIntl(<BirthTimeField value="" onChange={vi.fn()} label="시간 입력" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    expect(document.querySelector('.tray.on')).toBeTruthy();
    expect(document.querySelector('.picker-cols')).toBeTruthy();
    expect(document.querySelector('.picker-colon')).toBeTruthy();
    expect(document.querySelectorAll('.picker-col')).toHaveLength(2);
  });

  it('emits HH:mm on 완료', () => {
    const onChange = vi.fn();
    renderWithIntl(<BirthTimeField value="" onChange={onChange} label="시간 입력" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    // default: 14:20 — click an hour option to change hour to 09
    const hour09 = Array.from(document.querySelectorAll('.picker-col')[0].querySelectorAll('.opt'))
      .find(el => el.textContent === '09') as HTMLElement;
    fireEvent.click(hour09);
    const min00 = Array.from(document.querySelectorAll('.picker-col')[1].querySelectorAll('.opt'))
      .find(el => el.textContent === '00') as HTMLElement;
    fireEvent.click(min00);
    fireEvent.click(screen.getByText('완료'));
    expect(onChange).toHaveBeenCalledWith('09:00');
  });

  it('emits 00:00 round-trip (padStart check)', () => {
    const onChange = vi.fn();
    renderWithIntl(<BirthTimeField value="" onChange={onChange} label="시간 입력" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    const hour00 = Array.from(document.querySelectorAll('.picker-col')[0].querySelectorAll('.opt'))
      .find(el => el.textContent === '00') as HTMLElement;
    fireEvent.click(hour00);
    const min00 = Array.from(document.querySelectorAll('.picker-col')[1].querySelectorAll('.opt'))
      .find(el => el.textContent === '00') as HTMLElement;
    fireEvent.click(min00);
    fireEvent.click(screen.getByText('완료'));
    expect(onChange).toHaveBeenCalledWith('00:00');
  });

  it('취소 closes tray without calling onChange', () => {
    const onChange = vi.fn();
    renderWithIntl(<BirthTimeField value="" onChange={onChange} label="시간 입력" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    fireEvent.click(screen.getByText('취소'));
    expect(document.querySelector('.tray.on')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('re-open with value 14:30 shows 14 and 30 as selected in wheels', () => {
    renderWithIntl(<BirthTimeField value="14:30" onChange={vi.fn()} label="시간 입력" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    const hourCol = document.querySelectorAll('.picker-col')[0];
    const minCol = document.querySelectorAll('.picker-col')[1];
    expect(hourCol.querySelector('.opt.sel')?.textContent).toBe('14');
    expect(minCol.querySelector('.opt.sel')?.textContent).toBe('30');
  });
});
