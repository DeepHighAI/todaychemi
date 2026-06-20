import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { CtaBar } from './CtaBar';

describe('CtaBar', () => {
  it('주요 CTA 강조(btn-cta) 클래스를 적용한다', () => {
    renderWithProviders(<CtaBar label="다음" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: '다음' })).toHaveClass('btn-cta');
  });
});
