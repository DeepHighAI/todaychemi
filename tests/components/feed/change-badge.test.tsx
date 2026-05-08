// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { renderWithIntl } from '../../utils/render-with-intl';

describe('ChangeBadge', () => {
  it('significant=true → data-testid="change-badge" 배지 렌더됨', async () => {
    const { ChangeBadge } = await import('@/components/feed/ChangeBadge');
    renderWithIntl(<ChangeBadge significant={true} changeScore={15} />);
    expect(screen.getByTestId('change-badge')).toBeInTheDocument();
  });

  it('significant=false → 렌더 안 됨 (null 반환)', async () => {
    const { ChangeBadge } = await import('@/components/feed/ChangeBadge');
    const { container } = renderWithIntl(<ChangeBadge significant={false} changeScore={3} />);
    expect(container.firstChild).toBeNull();
  });

  it('change_score > 0 → "+{n}" 포함 표시', async () => {
    const { ChangeBadge } = await import('@/components/feed/ChangeBadge');
    renderWithIntl(<ChangeBadge significant={true} changeScore={15} />);
    expect(screen.getByTestId('change-badge').textContent).toContain('+15');
  });

  it('change_score < 0 → "-{n}" 포함 표시 (음수 그대로)', async () => {
    const { ChangeBadge } = await import('@/components/feed/ChangeBadge');
    renderWithIntl(<ChangeBadge significant={true} changeScore={-12} />);
    expect(screen.getByTestId('change-badge').textContent).toContain('-12');
  });

  it('change_score = threshold 경계값(10) → 배지 렌더됨', async () => {
    const { ChangeBadge } = await import('@/components/feed/ChangeBadge');
    renderWithIntl(<ChangeBadge significant={true} changeScore={10} />);
    expect(screen.getByTestId('change-badge')).toBeInTheDocument();
  });

  it('useTranslations 의 messages 변경에 반응한다 (i18n 통합 증명)', async () => {
    const { ChangeBadge } = await import('@/components/feed/ChangeBadge');
    const customMessages = { feed: { badge: { change_significant: 'BIG {delta}' } } };
    render(
      <NextIntlClientProvider locale="en" messages={customMessages}>
        <ChangeBadge significant={true} changeScore={15} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('change-badge').textContent).toBe('BIG +15');
  });
});
