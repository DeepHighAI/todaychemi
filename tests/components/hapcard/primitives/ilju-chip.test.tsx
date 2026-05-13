// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IljuChip } from '@/components/hapcard/primitives/ilju-chip';

describe('IljuChip', () => {
  it('일주 텍스트를 렌더', () => {
    render(<IljuChip pillar="갑인" element="목" />);
    expect(screen.getByText('갑인')).toBeInTheDocument();
  });

  it('목 → bg-element-wood 클래스', () => {
    const { container } = render(<IljuChip pillar="갑인" element="목" />);
    expect(container.firstChild).toHaveClass('bg-element-wood');
  });

  it('화 → bg-element-fire 클래스', () => {
    const { container } = render(<IljuChip pillar="병오" element="화" />);
    expect(container.firstChild).toHaveClass('bg-element-fire');
  });

  it('토 → bg-element-earth 클래스', () => {
    const { container } = render(<IljuChip pillar="무진" element="토" />);
    expect(container.firstChild).toHaveClass('bg-element-earth');
  });

  it('금 → bg-element-metal 클래스', () => {
    const { container } = render(<IljuChip pillar="경신" element="금" />);
    expect(container.firstChild).toHaveClass('bg-element-metal');
  });

  it('수 → bg-element-water 클래스', () => {
    const { container } = render(<IljuChip pillar="임자" element="수" />);
    expect(container.firstChild).toHaveClass('bg-element-water');
  });

  it('목 element에 hanja title 속성 "木" (elementLabel 사용 확인)', () => {
    const { container } = render(<IljuChip pillar="갑인" element="목" />);
    expect(container.firstChild).toHaveAttribute('title', '木');
  });

  it('ADR-038: raw Hanja pillar → Korean 음독 변환 (丙寅 → 병인)', () => {
    render(<IljuChip pillar="丙寅" element="화" />);
    expect(screen.getByText('병인')).toBeInTheDocument();
    expect(screen.queryByText('丙寅')).not.toBeInTheDocument();
  });

  it('ADR-038: raw Hanja pillar → Korean 음독 변환 (辛亥 → 신해)', () => {
    render(<IljuChip pillar="辛亥" element="금" />);
    expect(screen.getByText('신해')).toBeInTheDocument();
    expect(screen.queryByText('辛亥')).not.toBeInTheDocument();
  });
});
