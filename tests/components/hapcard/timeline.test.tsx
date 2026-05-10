// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardTimeline } from '@/components/hapcard/timeline';
import type { HapcardSnapshotsResponse } from '@/types/hapcard';

const DEFAULT_PROPS = { hapcardId: 'h1', mode: '친구합' };

const FULL_DATA: HapcardSnapshotsResponse = {
  today_index: 3,
  snapshots: [
    { date: '2026-05-07', score: 60 },
    { date: '2026-05-08', score: 65 },
    { date: '2026-05-09', score: 70 },
    { date: '2026-05-10', score: 75 },
    { date: '2026-05-11', score: null },
    { date: '2026-05-12', score: null },
    { date: '2026-05-13', score: null },
  ],
};

const ALL_NULL_DATA: HapcardSnapshotsResponse = {
  today_index: 3,
  snapshots: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-05-${String(7 + i).padStart(2, '0')}`,
    score: null,
  })),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HapcardTimeline — loading', () => {
  it('fetch 진행 중 → skeleton 표시', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<HapcardTimeline {...DEFAULT_PROPS} />);
    expect(await screen.findByTestId('hapcard-timeline-skeleton')).toBeInTheDocument();
  });
});

describe('HapcardTimeline — data', () => {
  it('데이터 로드 → 7개 막대 + data-testid="hapcard-timeline"', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => FULL_DATA,
    } as Response);

    renderWithProviders(<HapcardTimeline {...DEFAULT_PROPS} />);

    await waitFor(() =>
      expect(document.querySelector('[data-testid="hapcard-timeline"]')).not.toBeNull(),
    );

    const bars = document.querySelectorAll('[data-testid="hapcard-timeline-bar"]');
    expect(bars).toHaveLength(7);
  });
});

describe('HapcardTimeline — empty (모두 null)', () => {
  it('7칸 모두 score=null → placeholder bar 7개 렌더', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ALL_NULL_DATA,
    } as Response);

    renderWithProviders(<HapcardTimeline {...DEFAULT_PROPS} />);

    await waitFor(() =>
      expect(document.querySelector('[data-testid="hapcard-timeline"]')).not.toBeNull(),
    );

    const bars = document.querySelectorAll('[data-testid="hapcard-timeline-bar"]');
    expect(bars).toHaveLength(7);
  });
});

describe('HapcardTimeline — error', () => {
  it('fetch 실패 → role="alert" 에러 메시지 표시', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network Error'));
    renderWithProviders(<HapcardTimeline {...DEFAULT_PROPS} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('HapcardTimeline — today highlight', () => {
  it('today_index=3 막대만 data-today="true", 나머지 false', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => FULL_DATA,
    } as Response);

    renderWithProviders(<HapcardTimeline {...DEFAULT_PROPS} />);

    await waitFor(() =>
      expect(document.querySelector('[data-testid="hapcard-timeline"]')).not.toBeNull(),
    );

    const bars = document.querySelectorAll('[data-testid="hapcard-timeline-bar"]');
    const todayBars = Array.from(bars).filter((b) => b.getAttribute('data-today') === 'true');
    const otherBars = Array.from(bars).filter((b) => b.getAttribute('data-today') !== 'true');

    expect(todayBars).toHaveLength(1);
    expect(otherBars).toHaveLength(6);
    // 인덱스 3이 today
    expect(bars[3].getAttribute('data-today')).toBe('true');
  });
});
