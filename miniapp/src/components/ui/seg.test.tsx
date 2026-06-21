import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { Seg } from './seg';

const OPTS = [
  { value: 'a', label: '에이' },
  { value: 'b', label: '비' },
  { value: 'c', label: '시' },
] as const;

describe('Seg', () => {
  it('모든 옵션 라벨을 렌더한다', () => {
    render(<Seg options={OPTS} value="a" onChange={() => {}} ariaLabel="선택" />);
    expect(screen.getByText('에이')).toBeTruthy();
    expect(screen.getByText('비')).toBeTruthy();
    expect(screen.getByText('시')).toBeTruthy();
  });

  it('옵션 클릭 시 onChange(value) 를 호출한다', () => {
    const onChange = vi.fn();
    render(<Seg options={OPTS} value="a" onChange={onChange} ariaLabel="선택" />);
    fireEvent.click(screen.getByText('비'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('기본 role 은 radiogroup, 아이템은 radio + aria-checked', () => {
    render(<Seg options={OPTS} value="b" onChange={() => {}} ariaLabel="선택" />);
    const group = screen.getByRole('radiogroup', { name: '선택' });
    expect(group).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
  });

  it('role=tablist 이면 컨테이너 tablist, 아이템 tab + aria-selected', () => {
    render(<Seg options={OPTS} value="c" onChange={() => {}} role="tablist" ariaLabel="탭" />);
    expect(screen.getByRole('tablist', { name: '탭' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });

  it('variant=segment: 활성 아이템은 떠있는 pill(--e-1 그림자), 비활성은 그림자 없음', () => {
    render(<Seg options={OPTS} value="a" onChange={() => {}} variant="segment" ariaLabel="선택" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0].style.boxShadow).toContain('var(--e-1)');
    expect(radios[1].style.boxShadow).toBe('none');
  });

  it('variant=segment accent: 활성 텍스트가 --p-40(.itabs 레시피)', () => {
    render(
      <Seg options={OPTS} value="a" onChange={() => {}} variant="segment" accent ariaLabel="탭" />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0].style.color).toContain('var(--p-40)');
    // accent 트랙은 --surface-1
    expect(screen.getByRole('radiogroup').style.background).toContain('var(--surface-1)');
  });

  it('variant=fill: 활성 아이템은 --p-40 채움, 비활성은 --surface-2', () => {
    render(<Seg options={OPTS} value="a" onChange={() => {}} variant="fill" ariaLabel="선택" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0].style.backgroundColor).toContain('var(--p-40)');
    expect(radios[1].style.backgroundColor).toContain('var(--surface-2)');
  });

  it('로빙 tabindex: 활성 아이템만 0, 나머지는 -1', () => {
    render(<Seg options={OPTS} value="b" onChange={() => {}} ariaLabel="선택" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[1].getAttribute('tabindex')).toBe('0');
    expect(radios[0].getAttribute('tabindex')).toBe('-1');
    expect(radios[2].getAttribute('tabindex')).toBe('-1');
  });

  it('ArrowRight 는 다음 옵션을 선택한다', () => {
    const onChange = vi.fn();
    render(<Seg options={OPTS} value="a" onChange={onChange} ariaLabel="선택" />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('ArrowLeft 는 첫 옵션에서 마지막으로 순환한다', () => {
    const onChange = vi.fn();
    render(<Seg options={OPTS} value="a" onChange={onChange} ariaLabel="선택" />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('Home/End 는 첫/마지막 옵션을 선택한다', () => {
    const onChange = vi.fn();
    render(<Seg options={OPTS} value="b" onChange={onChange} ariaLabel="선택" />);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('a');
    fireEvent.keyDown(group, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
  });

  it('icon 제공 시 렌더한다', () => {
    const opts = [
      { value: 'x', label: '엑스', icon: <span data-testid="icon-x" /> },
      { value: 'y', label: '와이' },
    ] as const;
    render(<Seg options={opts} value="x" onChange={() => {}} ariaLabel="선택" />);
    expect(screen.getByTestId('icon-x')).toBeTruthy();
  });

  it('columns 지정 시 그리드 컬럼을 설정한다', () => {
    render(
      <Seg options={OPTS} value="a" onChange={() => {}} variant="fill" columns={3} ariaLabel="선택" />,
    );
    const group = screen.getByRole('radiogroup');
    expect(group.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('fill shape=rounded 는 --r-sm, 기본 pill 은 --r-pill 반경', () => {
    const { rerender } = render(
      <Seg options={OPTS} value="a" onChange={() => {}} variant="fill" ariaLabel="선택" />,
    );
    expect(screen.getAllByRole('radio')[0].style.borderRadius).toBe('var(--r-pill)');
    rerender(
      <Seg options={OPTS} value="a" onChange={() => {}} variant="fill" shape="rounded" ariaLabel="선택" />,
    );
    expect(screen.getAllByRole('radio')[0].style.borderRadius).toBe('var(--r-sm)');
  });
});
