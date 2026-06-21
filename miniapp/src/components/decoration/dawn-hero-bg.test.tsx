import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { DawnHeroBg } from './dawn-hero-bg';

// 오행 잉크 블롭 매핑 — fill 토큰 + 애니메이션 클래스(레퍼런스 dawn-hero-bg 동일)
const ELEMENTS = [
  { el: 'wood', fill: 'var(--accent-wood)', drift: 'anim-dawn-drift-1' },
  { el: 'fire', fill: 'var(--accent-fire)', drift: 'anim-dawn-drift-2' },
  { el: 'earth', fill: 'var(--accent-earth)', drift: 'anim-dawn-drift-2' },
  { el: 'water', fill: 'var(--accent-water)', drift: 'anim-dawn-drift-1' },
  { el: 'metal', fill: 'var(--accent-metal)', drift: 'anim-dawn-drift-2' },
] as const;

// NOTE: jsdom 은 그라데이션·blur·mix-blend-mode·SVG 필터·prefers-reduced-motion 를
// 계산하지 않는다 → 구조/속성/클래스 토글만 단언. 시각/모션 정지는 브라우저 QA.
describe('DawnHeroBg', () => {
  it('워터컬러 svg 를 렌더한다(viewBox + 비균일 스트레치)', () => {
    const { container } = render(<DawnHeroBg />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 360 220');
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('none');
  });

  it('오행 잉크 블롭을 정확히 5개, 원소별 색으로 렌더한다', () => {
    const { container } = render(<DawnHeroBg />);
    expect(container.querySelectorAll('[data-element]')).toHaveLength(5);
    for (const { el, fill } of ELEMENTS) {
      const node = container.querySelector(`[data-element="${el}"]`);
      expect(node?.getAttribute('fill')).toBe(fill);
    }
  });

  it('새벽 하늘 글로우 타원을 토큰 색으로 렌더한다(오행 블롭 아님)', () => {
    const { container } = render(<DawnHeroBg />);
    const sky = container.querySelector('ellipse[fill="var(--dawn-sky)"]');
    expect(sky).toBeTruthy();
    expect(sky?.getAttribute('opacity')).toBe('0.6');
    expect(sky?.getAttribute('data-element')).toBeNull();
  });

  it('animated(기본) 시 원소별 drift 애니메이션 클래스를 부여한다', () => {
    const { container } = render(<DawnHeroBg />);
    for (const { el, drift } of ELEMENTS) {
      const node = container.querySelector(`[data-element="${el}"]`);
      expect(node?.getAttribute('class')).toContain(drift);
    }
  });

  it('animated=false 시 애니메이션 클래스를 부여하지 않는다', () => {
    const { container } = render(<DawnHeroBg animated={false} />);
    expect(container.querySelectorAll('[class*="anim-dawn-"]')).toHaveLength(0);
  });

  it('종이 grain 레이어를 렌더한다', () => {
    const { container } = render(<DawnHeroBg />);
    expect(container.querySelector('.dawn-grain')).toBeTruthy();
  });
});
