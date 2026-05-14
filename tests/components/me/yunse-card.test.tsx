// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import type { YunseCore } from '@/types/chart';

const YUNSE: YunseCore = {
  daeun: {
    start_age: 7,
    list: Array.from({ length: 10 }, (_, i) => ({ age: 7 + 10 * i, pillar: `甲戌`, year: 1990 + 10 * i })),
    current_index: 3,
  },
  seyun: { current_pillar: '丙午', current_year: 2026 },
  wolun: { current_pillar: '계사', current_month: '2026-05' },
  iliun: { today_pillar: '갑자', today_date: '2026-05-07' },
};

async function renderCard() {
  const { default: YunseCard } = await import('@/components/me/yunse-card');
  return renderWithIntl(<YunseCard yunse={YUNSE} />);
}

describe('YunseCard', () => {
  it('renders title "운세 흐름"', async () => {
    await renderCard();
    expect(screen.getByText('운세 흐름')).toBeInTheDocument();
  });

  it('renders 10 daeun segments', async () => {
    await renderCard();
    const segments = screen.getAllByRole('listitem');
    expect(segments.length).toBeGreaterThanOrEqual(10);
  });

  it('current daeun segment has aria-current="true"', async () => {
    await renderCard();
    const current = screen.getAllByRole('listitem').find(el => el.getAttribute('aria-current') === 'true');
    expect(current).toBeDefined();
  });

  it('대운 한자 pillar(甲戌)를 한글 reading(갑술)으로 렌더 (ADR-038)', async () => {
    await renderCard();
    expect(screen.getAllByText('갑술').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('甲戌')).not.toBeInTheDocument();
  });

  it('seyun 한자 pillar(丙午)를 한글 reading(병오)으로 렌더 (ADR-038)', async () => {
    await renderCard();
    expect(screen.getByText('병오')).toBeInTheDocument();
    expect(screen.queryByText('丙午')).not.toBeInTheDocument();
  });

  it('renders wolun current_pillar', async () => {
    await renderCard();
    expect(screen.getByText('계사')).toBeInTheDocument();
  });

  it('renders iliun today_pillar', async () => {
    await renderCard();
    expect(screen.getByText('갑자')).toBeInTheDocument();
  });
});
