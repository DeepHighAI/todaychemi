import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('항목에 scroll-snap-stop:always 가 적용된다(플릭당 한 칸)', () => {
    render(<WheelColumn options={['01', '02']} value="01" onChange={vi.fn()} ariaLabel="월" />);
    expect(screen.getByText('02').style.scrollSnapStop).toBe('always');
  });
});

describe('WheelColumn — 스크롤 정지(rest) 디바운스', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // jsdom 은 레이아웃이 없어 scrollTop 이 0 으로 고정될 수 있으므로 명시적으로 정의한다.
  function setScrollTop(el: HTMLElement, top: number) {
    Object.defineProperty(el, 'scrollTop', { value: top, configurable: true, writable: true });
  }

  it('스크롤 중에는 onChange 를 발화하지 않고, 정지 후 스냅 위치 항목으로 1회만 발화한다', () => {
    const onChange = vi.fn();
    render(<WheelColumn options={['01', '02', '03']} value="01" onChange={onChange} ariaLabel="월" />);
    const list = screen.getByRole('listbox', { name: '월' });
    setScrollTop(list, 80); // index 2 (= '03')

    // 연속 스크롤 프레임 — 아직 정지 전이므로 onChange 안 됨.
    fireEvent.scroll(list);
    fireEvent.scroll(list);
    fireEvent.scroll(list);
    expect(onChange).not.toHaveBeenCalled();

    // 정지(settle) 후 1회만.
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('03');
  });

  it('정지 위치가 현재 값과 같으면 onChange 를 발화하지 않는다', () => {
    const onChange = vi.fn();
    render(<WheelColumn options={['01', '02', '03']} value="02" onChange={onChange} ariaLabel="월" />);
    const list = screen.getByRole('listbox', { name: '월' });
    setScrollTop(list, 40); // index 1 (= '02') — 현재 값과 동일
    fireEvent.scroll(list);
    vi.advanceTimersByTime(100);
    expect(onChange).not.toHaveBeenCalled();
  });
});
