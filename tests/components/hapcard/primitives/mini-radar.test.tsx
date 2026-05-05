// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MiniRadar } from '@/components/hapcard/primitives/mini-radar';

const USER = { 목: 30, 화: 20, 토: 20, 금: 15, 수: 15 };
const RELATION = { 목: 10, 화: 25, 토: 25, 금: 25, 수: 15 };

describe('MiniRadar', () => {
  it('role="img" SVG 1개 렌더', () => {
    render(<MiniRadar user={USER} relation={RELATION} />);
    expect(screen.getByRole('img', { name: /오행 비교 오각형/ })).toBeInTheDocument();
  });

  it('5개 원소 라벨(목 화 토 금 수) 모두 텍스트로 표기', () => {
    render(<MiniRadar user={USER} relation={RELATION} />);
    for (const el of ['목', '화', '토', '금', '수']) {
      expect(screen.getByText(el)).toBeInTheDocument();
    }
  });

  it('user/relation 두 polygon 렌더 (data-series 식별)', () => {
    const { container } = render(<MiniRadar user={USER} relation={RELATION} />);
    expect(container.querySelector('polygon[data-series="user"]')).not.toBeNull();
    expect(container.querySelector('polygon[data-series="relation"]')).not.toBeNull();
  });

  it('user polygon은 fill 채워짐 (none 아님)', () => {
    const { container } = render(<MiniRadar user={USER} relation={RELATION} />);
    const userPoly = container.querySelector('polygon[data-series="user"]');
    expect(userPoly?.getAttribute('fill')).not.toBe('none');
  });

  it('relation polygon은 fill="none" (외곽선만)', () => {
    const { container } = render(<MiniRadar user={USER} relation={RELATION} />);
    const relPoly = container.querySelector('polygon[data-series="relation"]');
    expect(relPoly?.getAttribute('fill')).toBe('none');
  });

  it('동일 counts 입력 시 두 polygon points 동일 (대칭 검증)', () => {
    const SAME = { 목: 1, 화: 1, 토: 1, 금: 1, 수: 1 };
    const { container } = render(<MiniRadar user={SAME} relation={SAME} />);
    const userPts = container.querySelector('polygon[data-series="user"]')?.getAttribute('points');
    const relPts = container.querySelector('polygon[data-series="relation"]')?.getAttribute('points');
    expect(userPts).toBe(relPts);
    expect(userPts).toBeTruthy();
  });

  it('모두 0일 때도 crash 없이 렌더 (zero-sum 처리)', () => {
    const ZERO = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    render(<MiniRadar user={ZERO} relation={ZERO} />);
    expect(screen.getByRole('img', { name: /오행 비교 오각형/ })).toBeInTheDocument();
  });
});
