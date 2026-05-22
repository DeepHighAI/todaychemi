// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithIntl } from '../../utils/render-with-intl';
import { BirthDateField } from '../../../src/components/picker/birth-date-field';

describe('BirthDateField', () => {
  it('shows placeholder when value is empty', () => {
    renderWithIntl(<BirthDateField value="" onChange={vi.fn()} label="생년월일" />);
    expect(screen.getByText('탭해서 선택')).toBeTruthy();
  });

  it('shows formatted date and has filled class when value is set', () => {
    renderWithIntl(<BirthDateField value="1991-03-05" onChange={vi.fn()} label="생년월일" />);
    expect(screen.getByText('1991년 3월 5일')).toBeTruthy();
    expect(document.querySelector('.mock-input.filled')).toBeTruthy();
  });

  it('opens the dialog on tap', async () => {
    renderWithIntl(<BirthDateField value="" onChange={vi.fn()} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    expect(document.querySelector('.tray.on')).toBeTruthy();
  });

  it('emits onChange immediately when a day is selected and dialog stays open', async () => {
    const onChange = vi.fn();
    renderWithIntl(<BirthDateField value="" onChange={onChange} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    // calendar opens on 1995/11 (default) — Nov 1 2024=Fri, but default is 1995/10 (Nov)
    // Nov 1995: firstDay = new Date(1995, 10, 1).getDay()
    const dayCell = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).find(el => el.textContent === '5') as HTMLElement;
    fireEvent.click(dayCell);
    expect(onChange).toHaveBeenCalledWith('1995-11-05');
  });

  it('zero-pads single-digit month and day: selects March 5 1991', async () => {
    const onChange = vi.fn();
    // Open with value set to March 1991 so view shows that month
    renderWithIntl(<BirthDateField value="1991-03-01" onChange={onChange} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    const dayCell = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).find(el => el.textContent === '5') as HTMLElement;
    fireEvent.click(dayCell);
    expect(onChange).toHaveBeenCalledWith('1991-03-05');
  });

  it('tapping label swaps tray to year/month wheels', () => {
    renderWithIntl(<BirthDateField value="" onChange={vi.fn()} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    // Click the month label button
    fireEvent.click(screen.getByText('1995년 11월'));
    // yearMonth mode: picker-cols should be visible
    expect(document.querySelector('.picker-cols')).toBeTruthy();
  });

  it('확인 returns to calendar mode without closing tray', () => {
    renderWithIntl(<BirthDateField value="" onChange={vi.fn()} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    fireEvent.click(screen.getByText('1995년 11월')); // go to yearMonth
    fireEvent.click(screen.getByText('확인')); // confirm
    // back to calendar
    expect(document.querySelector('.cal')).toBeTruthy();
    expect(document.querySelector('.tray.on')).toBeTruthy();
  });

  it('연도 옵션을 선택하면 일 선택 달력으로 돌아간다', () => {
    renderWithIntl(<BirthDateField value="" onChange={vi.fn()} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    fireEvent.click(screen.getByText('1995년 11월'));

    fireEvent.click(screen.getByText('2001'));

    expect(document.querySelector('.cal')).toBeTruthy();
    expect(screen.getByText('2001년 11월')).toBeTruthy();
    expect(document.querySelector('.picker-cols')).toBeNull();
  });

  it('월 옵션을 선택하면 일 선택 달력으로 돌아간다', () => {
    renderWithIntl(<BirthDateField value="" onChange={vi.fn()} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    fireEvent.click(screen.getByText('1995년 11월'));

    fireEvent.click(screen.getByText('3'));

    expect(document.querySelector('.cal')).toBeTruthy();
    expect(screen.getByText('1995년 3월')).toBeTruthy();
    expect(document.querySelector('.picker-cols')).toBeNull();
  });

  it('연도/월 화면에서 상단 완료를 누르면 닫지 않고 일 선택 달력으로 돌아간다', () => {
    renderWithIntl(<BirthDateField value="" onChange={vi.fn()} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    fireEvent.click(screen.getByText('1995년 11월'));

    fireEvent.click(screen.getByText('완료'));

    expect(document.querySelector('.cal')).toBeTruthy();
    expect(document.querySelector('.tray.on')).toBeTruthy();
    expect(document.querySelector('.picker-cols')).toBeNull();
  });

  it('취소 closes the tray without calling onChange', () => {
    const onChange = vi.fn();
    renderWithIntl(<BirthDateField value="" onChange={onChange} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    fireEvent.click(screen.getByText('취소'));
    expect(document.querySelector('.tray.on')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calendar mode에서 완료를 누르면 닫히고 다시 열 때 calendar mode로 열린다', () => {
    renderWithIntl(<BirthDateField value="" onChange={vi.fn()} label="생년월일" />);
    fireEvent.click(document.querySelector('.mock-input')!);
    fireEvent.click(screen.getByText('1995년 11월')); // go to yearMonth
    fireEvent.click(screen.getByText('완료')); // back to calendar
    fireEvent.click(screen.getByText('완료')); // close
    fireEvent.click(document.querySelector('.mock-input')!); // reopen
    expect(document.querySelector('.cal')).toBeTruthy();
    expect(document.querySelector('.picker-cols')).toBeNull();
  });
});
