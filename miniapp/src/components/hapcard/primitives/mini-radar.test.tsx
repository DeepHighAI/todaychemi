import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import type { OhaengElement } from '@/lib/saju/elementLabel';
import { MiniRadar } from './mini-radar';

function counts(o: Partial<Record<OhaengElement, number>>): Record<OhaengElement, number> {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0, ...o };
}

const user = counts({ 목: 3, 화: 2, 토: 1, 금: 1, 수: 1 });
const relation = counts({ 목: 1, 화: 1, 토: 2, 금: 2, 수: 2 });

describe('MiniRadar (오행 오버레이 레이더)', () => {
  it('오버레이 레이더 svg 와 aria-label 를 렌더한다', () => {
    const { container } = render(<MiniRadar user={user} relation={relation} />);
    expect(container.querySelector('svg[aria-label="오행 비교 오각형"]')).not.toBeNull();
  });

  it('본인·인연 두 데이터 다각형을 렌더한다', () => {
    const { container } = render(<MiniRadar user={user} relation={relation} />);
    expect(container.querySelector('polygon[data-series="user"]')).not.toBeNull();
    expect(container.querySelector('polygon[data-series="relation"]')).not.toBeNull();
  });

  it('본인 다각형은 primary 채움, 인연은 점선 stroke 를 쓴다', () => {
    const { container } = render(<MiniRadar user={user} relation={relation} />);
    expect(container.querySelector('polygon[data-series="user"]')?.getAttribute('fill')).toBe(
      'var(--primary)',
    );
    expect(
      container.querySelector('polygon[data-series="relation"]')?.getAttribute('stroke-dasharray'),
    ).toBe('3 2');
  });

  it('5개 한글 원소 라벨을 렌더하고 한자를 노출하지 않는다 (ADR-038)', () => {
    const { container } = render(<MiniRadar user={user} relation={relation} />);
    const labels = Array.from(container.querySelectorAll('text')).map((n) => n.textContent);
    expect(labels).toEqual(['목', '화', '토', '금', '수']);
    expect(container.textContent ?? '').not.toMatch(/[木火土金水]/);
  });

  it('전부 0 카운트여도 throw 하지 않는다', () => {
    expect(() => render(<MiniRadar user={counts({})} relation={counts({})} />)).not.toThrow();
  });
});
