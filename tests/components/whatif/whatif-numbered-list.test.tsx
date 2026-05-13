// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhatifNumberedList } from '@/components/whatif/whatif-numbered-list';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('WhatifNumberedList', () => {
  it('renders the title via i18n key', () => {
    render(<WhatifNumberedList testid="test-list" titleKey="section.test" items={['항목1', '항목2']} />);
    expect(screen.getByText('section.test')).toBeTruthy();
  });

  it('renders all items with sequential numbers', () => {
    render(<WhatifNumberedList testid="test-list" titleKey="section.test" items={['가', '나', '다']} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('가')).toBeTruthy();
    expect(screen.getByText('다')).toBeTruthy();
  });

  it('applies data-testid from prop', () => {
    const { container } = render(<WhatifNumberedList testid="my-list" titleKey="k" items={[]} />);
    expect(container.querySelector('[data-testid="my-list"]')).toBeTruthy();
  });

  it('renders zero <li> when items is empty', () => {
    const { container } = render(<WhatifNumberedList testid="empty" titleKey="k" items={[]} />);
    expect(container.querySelectorAll('li').length).toBe(0);
  });
});
