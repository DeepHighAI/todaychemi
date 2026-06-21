import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Bar } from './bar';

describe('Bar (수평 fill 프리미티브)', () => {
  it('value/max 비율로 fill width 를 설정한다', () => {
    render(<Bar value={30} max={120} color="var(--primary)" ariaLabel="비율" />);
    expect(screen.getByRole('progressbar').style.width).toBe('25%');
  });

  it('100% 초과는 100%로, 음수는 0%로 클램프한다', () => {
    const { rerender } = render(<Bar value={500} color="red" ariaLabel="over" />);
    expect(screen.getByRole('progressbar').style.width).toBe('100%');
    rerender(<Bar value={-10} color="red" ariaLabel="under" />);
    expect(screen.getByRole('progressbar').style.width).toBe('0%');
  });

  it('max<=0 이어도 NaN 없이 렌더한다', () => {
    render(<Bar value={5} max={0} color="red" ariaLabel="zeromax" />);
    expect(screen.getByRole('progressbar').style.width).toBe('100%');
  });

  it('color 를 fill 배경색으로 적용한다', () => {
    render(<Bar value={50} color="var(--accent-wood)" ariaLabel="색" />);
    expect(screen.getByRole('progressbar').style.backgroundColor).toContain('var(--accent-wood)');
  });

  it("anchor='end' 면 fill 을 우측 정렬(marginLeft auto)한다", () => {
    render(<Bar value={50} color="red" anchor="end" ariaLabel="우측" />);
    expect(screen.getByRole('progressbar').style.marginLeft).toBe('auto');
  });

  it('anchor 기본값(start)은 marginLeft 를 두지 않는다', () => {
    render(<Bar value={50} color="red" ariaLabel="좌측" />);
    expect(screen.getByRole('progressbar').style.marginLeft).toBe('');
  });

  it('ariaLabel 지정 시 role=progressbar + aria-* 를 부여한다', () => {
    render(<Bar value={40} max={80} color="red" ariaLabel="대화 40" />);
    const fill = screen.getByRole('progressbar');
    expect(fill).toHaveAttribute('aria-label', '대화 40');
    expect(fill).toHaveAttribute('aria-valuenow', '40');
    expect(fill).toHaveAttribute('aria-valuemin', '0');
    expect(fill).toHaveAttribute('aria-valuemax', '80');
  });

  it('ariaLabel 미지정 시 role 을 부여하지 않는다(순수 장식)', () => {
    render(<Bar value={40} color="red" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('기본 트랙 색은 --hairline (카드 위 라이트/다크 모두 가시)', () => {
    const { container } = render(<Bar value={50} color="red" ariaLabel="t" />);
    const track = container.firstElementChild as HTMLElement;
    expect(track.style.backgroundColor).toContain('var(--hairline)');
  });

  it('trackColor override 가 적용된다', () => {
    const { container } = render(
      <Bar value={50} color="red" trackColor="var(--surface-1)" ariaLabel="t" />,
    );
    const track = container.firstElementChild as HTMLElement;
    expect(track.style.backgroundColor).toContain('var(--surface-1)');
  });
});
