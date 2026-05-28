// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/render-with-providers';
import type { RelationDetailResponse } from '@/types/relation';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ relationId: 'rel-001' }),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const DETAIL_OK: RelationDetailResponse = {
  relation: { relation_id: 'rel-001', nickname: '봄달', mode: '친구합', created_at: '2026-05-01T00:00:00Z' },
  chart: null,
  flow: [
    { date: '2026-05-01', score: 60 },
    { date: '2026-05-02', score: 70 },
  ],
};

async function renderDetailPage() {
  const { default: RelationDetailPage } = await import('@/app/(app)/feed/[relationId]/page');
  return renderWithProviders(<RelationDetailPage />);
}

describe('RelationDetailPage', () => {
  it('로딩 중 skeleton 표시', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // 영구 pending
    await renderDetailPage();
    expect(document.querySelector('[data-testid="relation-detail-skeleton"]')).not.toBeNull();
  });

  it('별명·모드·CTA 정상 렌더', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => DETAIL_OK });
    await renderDetailPage();
    expect(await screen.findAllByText('봄달')).not.toHaveLength(0);
    expect(await screen.findByText('합카드 보기')).toBeInTheDocument();
  });

  it('fetch 에러 → 에러 카드 표시', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: { code: 'INTERNAL_ERROR' } }) });
    await renderDetailPage();
    expect(await screen.findByTestId('error-card')).toBeInTheDocument();
  });

  it('flow 데이터 있으면 RelationFlowChart 마운트', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => DETAIL_OK });
    await renderDetailPage();
    expect(await screen.findByTestId('flow-chart')).toBeInTheDocument();
  });

  it('chart: null → 본명식 섹션 미표시', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...DETAIL_OK, chart: null }) });
    await renderDetailPage();
    await screen.findAllByText('봄달');
    expect(screen.queryByTestId('relation-chart-section')).toBeNull();
  });

  it('CTA 클릭 → router.push("/hapcard/rel-001?mode=친구합")', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => DETAIL_OK });
    await renderDetailPage();
    const btn = await screen.findByRole('button', { name: '합카드 보기' });
    await user.click(btn);
    expect(mockPush).toHaveBeenCalledWith(`/hapcard/rel-001?mode=${encodeURIComponent('친구합')}`);
  });

  it('GET /api/relations/[id] 호출 확인', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => DETAIL_OK });
    await renderDetailPage();
    await screen.findAllByText('봄달');
    expect(mockFetch).toHaveBeenCalledWith('/api/relations/rel-001');
  });
});
