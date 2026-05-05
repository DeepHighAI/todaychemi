// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OhaengBars } from '@/components/hapcard/primitives/ohaeng-bars';

const DATA = { 목: 30, 화: 20, 토: 20, 금: 15, 수: 15 };

describe('OhaengBars', () => {
  it('5개 progressbar role 렌더', () => {
    render(<OhaengBars data={DATA} />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(5);
  });

  it('각 bar에 aria-valuenow가 percent 값', () => {
    render(<OhaengBars data={DATA} />);
    const bars = screen.getAllByRole('progressbar');
    const nowValues = bars.map((b) => Number(b.getAttribute('aria-valuenow')));
    // 합이 100 (정규화됨)
    const sum = nowValues.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('목 bar에 bg-element-wood 클래스', () => {
    const { container } = render(<OhaengBars data={DATA} />);
    expect(container.querySelector('.bg-element-wood')).not.toBeNull();
  });

  it('화 bar에 bg-element-fire 클래스', () => {
    const { container } = render(<OhaengBars data={DATA} />);
    expect(container.querySelector('.bg-element-fire')).not.toBeNull();
  });

  it('모두 0일 때도 5개 bar 렌더 (0% 처리)', () => {
    render(<OhaengBars data={{ 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 }} />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(5);
  });
});
