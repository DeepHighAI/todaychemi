// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/render-with-providers';
import { mockHapcardResult } from '../../../../fixtures/hapcard';

const mockFetch = vi.fn();
let mockMode: string | null = '친구합';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'r1' }),
  useSearchParams: () => ({ get: (key: string) => (key === 'mode' ? mockMode : null) }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  mockMode = '친구합';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderHapcardPage() {
  const { default: HapcardPage } = await import('@/app/(app)/hapcard/[id]/page');
  return renderWithProviders(<HapcardPage />);
}


describe('HapcardPage', () => {
  it('shows loading skeleton while fetching', async () => {
    let resolve: (v: unknown) => void;
    mockFetch.mockReturnValue(new Promise((r) => { resolve = r; }));
    await renderHapcardPage();
    expect(await screen.findByTestId('hapcard-skeleton')).toBeInTheDocument();
    resolve!({ ok: true, json: async () => mockHapcardResult });
  });

  it('shows generic error when mode query param is missing', async () => {
    mockMode = null;
    await renderHapcardPage();
    expect(
      await screen.findByText('합카드를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows placeholder on successful fetch', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockHapcardResult });
    await renderHapcardPage();
    // Placeholder div has no testid; assert by its unique text content
    expect(await screen.findByText('합카드 본문은 곧 준비됩니다.')).toBeInTheDocument();
  });

  it('sends correct POST body with DEFAULT_THEORY_PROFILE_VERSION', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockHapcardResult });
    await renderHapcardPage();

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      relation_id: 'r1',
      mode: '친구합',
      theory_profile_version: 'v1',
    });
  });

  it('sends POST to /api/hapcards', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockHapcardResult });
    await renderHapcardPage();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/hapcards', expect.any(Object)));
  });

  it('shows chartPending card on RELATION_CHART_NOT_FOUND', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'RELATION_CHART_NOT_FOUND', message: 'not found' } }),
    });
    await renderHapcardPage();
    expect(await screen.findByText('합카드 준비 중')).toBeInTheDocument();
    expect(
      screen.getByText('인연의 사주 계산이 아직 준비되지 않았어요. 곧 자동으로 생성됩니다.'),
    ).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: '피드로 돌아가기' });
    expect(cta).toHaveAttribute('href', '/feed');
  });

  it('shows chartPending card on USER_CHART_NOT_FOUND', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'USER_CHART_NOT_FOUND', message: 'not found' } }),
    });
    await renderHapcardPage();
    expect(await screen.findByText('합카드 준비 중')).toBeInTheDocument();
  });

  it('shows generic error on 401', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'unauth' } }),
    });
    await renderHapcardPage();
    expect(
      await screen.findByText('합카드를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });

  it('shows generic error on 500', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'fail' } }),
    });
    await renderHapcardPage();
    expect(
      await screen.findByText('합카드를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });

  it('shows generic error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'));
    await renderHapcardPage();
    expect(
      await screen.findByText('합카드를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });
});
