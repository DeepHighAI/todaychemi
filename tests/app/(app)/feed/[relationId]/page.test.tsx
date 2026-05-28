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

// ─── Cycle 14: 메모 목록 로드 ──────────────────────────────────────────────

const MEMOS_OK = {
  items: [
    { memo_id: 'memo-1', relation_id: 'rel-001', body: '첫 메모', created_at: '2026-05-28T09:00:00Z', updated_at: '2026-05-28T09:00:00Z' },
  ],
};

function mockFetchBranched(detailRes = DETAIL_OK, memosRes = MEMOS_OK) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/memos')) {
      return Promise.resolve({ ok: true, json: async () => memosRes });
    }
    return Promise.resolve({ ok: true, json: async () => detailRes });
  });
}

describe('RelationDetailPage — 메모 목록', () => {
  it('GET /api/relations/rel-001/memos 호출', async () => {
    mockFetchBranched();
    await renderDetailPage();
    await screen.findAllByText('봄달');
    expect(mockFetch).toHaveBeenCalledWith('/api/relations/rel-001/memos');
  });

  it('메모 body 텍스트 렌더', async () => {
    mockFetchBranched();
    await renderDetailPage();
    expect(await screen.findByText('첫 메모')).toBeInTheDocument();
  });

  it('memo-list testid 렌더', async () => {
    mockFetchBranched();
    await renderDetailPage();
    await screen.findAllByText('봄달');
    expect(await screen.findByTestId('memo-list')).toBeInTheDocument();
  });
});

// ─── Cycle 15: 메모 CRUD 뮤테이션 + LOCKED 규칙 검증 ──────────────────────

describe('RelationDetailPage — 메모 추가', () => {
  it('"메모 추가" 버튼이 렌더됨', async () => {
    mockFetchBranched();
    await renderDetailPage();
    expect(await screen.findByRole('button', { name: '메모 추가' })).toBeInTheDocument();
  });

  it('메모 추가 submit → POST /api/relations/rel-001/memos 호출', async () => {
    const user = userEvent.setup();
    mockFetchBranched();
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/memos') && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, memo: MEMOS_OK.items[0] }) });
      }
      if (url.includes('/memos')) return Promise.resolve({ ok: true, json: async () => MEMOS_OK });
      return Promise.resolve({ ok: true, json: async () => DETAIL_OK });
    });

    await renderDetailPage();
    const addBtn = await screen.findByRole('button', { name: '메모 추가' });
    await user.click(addBtn);

    const input = await screen.findByTestId('memo-sheet-input');
    await user.type(input, '새 메모');
    await user.click(screen.getByTestId('memo-sheet-submit'));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/relations/rel-001/memos',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('LOCKED: 메모 추가 후 relation-detail 쿼리 미무효화', async () => {
    // 메모 mutation은 ['relation-detail'] 키를 invalidate 하면 안 됨 (island.md:183)
    // fetch 횟수를 세어 /api/relations/rel-001 (memos 아닌) 재호출 없음을 확인
    const user = userEvent.setup();
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/memos') && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, memo: MEMOS_OK.items[0] }) });
      }
      if (url.includes('/memos')) return Promise.resolve({ ok: true, json: async () => MEMOS_OK });
      return Promise.resolve({ ok: true, json: async () => DETAIL_OK });
    });

    await renderDetailPage();
    await screen.findAllByText('봄달');

    const detailCallsBefore = (mockFetch as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0] === '/api/relations/rel-001').length;

    const addBtn = await screen.findByRole('button', { name: '메모 추가' });
    await user.click(addBtn);
    const input = await screen.findByTestId('memo-sheet-input');
    await user.type(input, '새 메모');
    await user.click(screen.getByTestId('memo-sheet-submit'));

    // 짧은 대기 후 relation-detail 재호출 횟수 변화 없음 확인
    await new Promise((r) => setTimeout(r, 50));
    const detailCallsAfter = (mockFetch as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0] === '/api/relations/rel-001').length;

    expect(detailCallsAfter).toBe(detailCallsBefore);
  });
});
