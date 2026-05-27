// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const WALLET = {
  ok: true,
  balance: {
    balance: 55,
    next_expiry_at: null,
    next_expiry_amount: 0,
    monthly_used: 4,
    monthly_buckets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
  },
  ledger: [
    {
      ledger_id: 'ledger-1',
      user_id: 'user-1',
      delta: 55,
      balance_after: 55,
      reason: 'purchase',
      reference_id: 'payment-1',
      created_at: '2026-05-21T00:00:00Z',
    },
  ],
  has_more: false,
};

function mockChartAndWallet(chart: ChartCore | null = CHART) {
  mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.includes('/api/me/delete-request') && method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          deletion_requested_at: '2026-05-25T00:00:00.000Z',
          already_requested: false,
        }),
      });
    }
    if (url.includes('/api/me/wallet')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => WALLET,
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, chart }),
    });
  });
}

async function renderMePage() {
  const { default: MePage } = await import('@/app/(app)/me/page');
  return renderWithProviders(<MePage />);
}

describe('MePage (내 사주맵 화면)', () => {
  it('차트 로딩 중 → loading-state 렌더', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    await renderMePage();
    expect(await screen.findByTestId('loading-state')).toBeInTheDocument();
  });

  it('chart=null → empty-state + 등록 안내 문구 렌더', async () => {
    mockChartAndWallet(null);
    await renderMePage();
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(screen.getByText('내 사주맵이 아직 등록되지 않았어요.')).toBeInTheDocument();
  });

  it('chart 있을 때 "내 정보 수정" 행 카드 렌더 (MeEditRow)', async () => {
    mockChartAndWallet();
    await renderMePage();
    await waitFor(() => expect(screen.getByText('내 정보 수정')).toBeInTheDocument());
  });

  it('chart 있을 때 5개 섹션 모두 렌더 (me-hero / pillar-grid / ohaeng-bars / day-master-card / yunse-card)', async () => {
    mockChartAndWallet();
    await renderMePage();
    await waitFor(() => expect(screen.getByTestId('me-hero')).toBeInTheDocument());
    expect(screen.getByTestId('pillar-grid')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar').length).toBe(5);
    expect(screen.getByTestId('day-master-card')).toBeInTheDocument();
    expect(screen.getByTestId('yunse-card')).toBeInTheDocument();
  });

  it('chart 있을 때 부적 지갑 카드 렌더', async () => {
    mockChartAndWallet();
    await renderMePage();
    await waitFor(() => expect(screen.getByTestId('talisman-card')).toBeInTheDocument());
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /충전/ })).toBeInTheDocument();
  });

  it('chart 있을 때 개인정보 권리 행사 링크와 계정 삭제 요청을 제공한다', async () => {
    mockChartAndWallet();
    await renderMePage();
    await waitFor(() => expect(screen.getByText('내 데이터 내려받기')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: /내 데이터 내려받기/ })).toHaveAttribute(
      'href',
      '/api/me/export',
    );
    expect(screen.getByRole('button', { name: /계정 삭제 요청/ })).toBeInTheDocument();
  });

  it('계정 삭제 요청 확인 시 POST /api/me/delete-request 호출 후 접수 메시지를 보여준다', async () => {
    mockChartAndWallet();
    await renderMePage();
    await waitFor(() => expect(screen.getByRole('button', { name: /계정 삭제 요청/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /계정 삭제 요청/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: '삭제 요청' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '삭제 요청' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/me/delete-request', { method: 'POST' });
      expect(screen.getByText('계정 삭제 요청이 접수됐어요.')).toBeInTheDocument();
    });
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
