// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/render-with-providers';
import type { ChartCore } from '@/types/chart';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/me',
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CHART: ChartCore = {
  year_pillar: '辛未',
  month_pillar: '癸卯',
  day_pillar: '甲戌',
  hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
};

async function renderMePage() {
  const { default: MePage } = await import('@/app/(app)/me/page');
  return renderWithProviders(<MePage />);
}

describe('MePage (본명식 화면)', () => {
  it('차트 로딩 중 → loading-state 렌더', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    await renderMePage();
    expect(await screen.findByTestId('loading-state')).toBeInTheDocument();
  });

  it('chart=null → empty-state + 등록 안내 문구 렌더', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, chart: null }),
    });
    await renderMePage();
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(screen.getByText('본명식이 아직 등록되지 않았어요.')).toBeInTheDocument();
  });

  it('chart 있을 때 5개 섹션 모두 렌더 (me-hero / pillar-grid / ohaeng-bars / day-master-card / yunse-placeholder)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, chart: CHART }),
    });
    await renderMePage();
    await waitFor(() => expect(screen.getByTestId('me-hero')).toBeInTheDocument());
    expect(screen.getByTestId('pillar-grid')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar').length).toBe(5);
    expect(screen.getByTestId('day-master-card')).toBeInTheDocument();
    expect(screen.getByTestId('yunse-placeholder')).toBeInTheDocument();
  });

  it('fetch 실패 → error-card 렌더', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    });
    await renderMePage();
    await waitFor(() => expect(screen.getByTestId('error-card')).toBeInTheDocument());
  });
});
