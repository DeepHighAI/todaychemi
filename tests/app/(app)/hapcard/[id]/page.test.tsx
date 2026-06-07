// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/render-with-providers';
import { mockHapcardResult, withVisuals } from '../../../../fixtures/hapcard';

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
    expect(await screen.findByTestId('hapcard-loading-state')).toBeInTheDocument();
    expect(screen.getByText('두 사람의 흐름을 분석하고 있어요')).toBeInTheDocument();
    expect(screen.getByTestId('hapcard-loading-estimate')).toHaveTextContent('보통 20~40초 정도 걸려요');
    expect(await screen.findByTestId('hapcard-skeleton')).toBeInTheDocument();
    resolve!({ ok: true, json: async () => mockHapcardResult });
  });

  it('shows generic error when mode query param is missing', async () => {
    mockMode = null;
    await renderHapcardPage();
    expect(
      await screen.findByText('오늘 케미를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows placeholder on successful fetch', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockHapcardResult });
    await renderHapcardPage();
    // Placeholder div has no testid; assert by its unique text content
    expect(await screen.findByText('오늘 케미 본문은 곧 준비됩니다.')).toBeInTheDocument();
  });

  it('renders AppBar day pillars as Korean readings when visuals contain Hanja (ADR-038)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => withVisuals({
        relation_nickname: '테스트1',
        visuals: {
          user: {
            day_pillar: '戊申',
            day_master_element: '토',
            five_elements_counts: { 목: 1, 화: 1, 토: 3, 금: 2, 수: 1 },
          },
          relation: {
            day_pillar: '戊午',
            day_master_element: '토',
            five_elements_counts: { 목: 1, 화: 2, 토: 3, 금: 1, 수: 1 },
          },
        },
      }),
    });
    await renderHapcardPage();

    expect(await screen.findByText('테스트1 · 무신 ↔ 무오')).toBeInTheDocument();
    expect(screen.getByText('38.2')).toBeInTheDocument();
    expect(screen.getByText('°C')).toBeInTheDocument();
    expect(screen.queryByText('/100')).toBeNull();
    expect(screen.queryByText(/戊申|戊午/)).not.toBeInTheDocument();
  });

  it('renders the hero as conversational coaching instead of duplicating the detail summary', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => withVisuals({
        relation_nickname: '테스트1',
        content: {
          ...mockHapcardResult.content,
          main_text: '결론: 함께 일할 때 기준이 비슷합니다. 강점으로는 안정적인 실행과 빠른 아이디어가 서로 보완됩니다. 주의점으로는 역할이 겹치지 않게 나누는 약속이 필요합니다.',
          why_cards: [
            { title: '편한 동류감', reason: '서로 비슷해서 초반 대화가 편하게 이어집니다.' },
            { title: '감정 표현 겹침 주의', reason: '서로 비슷해서 눈치싸움이 생길 수 있습니다.' },
          ],
          actions: ['초반에는 약속을 작게 잡고 상대 반응을 천천히 확인하세요.'],
        },
      }),
    });
    await renderHapcardPage();

    expect(await screen.findByTestId('hapcard-hero-main-text')).toHaveClass('space-y-2.5');
    expect(screen.getByTestId('hapcard-hero-line-good').textContent).toBe(
      '"좋아!" 서로 비슷해서 초반 대화가 편하게 이어져요.',
    );
    expect(screen.getByTestId('hapcard-hero-line-caution').textContent).toBe(
      '"조심!" 서로 비슷해서 눈치싸움이 생길 수 있어요.',
    );
    expect(screen.getByTestId('hapcard-hero-line-tip').textContent).toBe(
      '"이렇게 해봐!" 초반에는 약속을 작게 잡고 상대 반응을 천천히 확인하세요.',
    );
    expect(screen.getByText('"좋아!"')).toHaveClass('font-black');
    expect(screen.getByText('"조심!"')).toHaveClass('font-black');
    expect(screen.getByText('"이렇게 해봐!"')).toHaveClass('font-black');
    expect(screen.getByText('"좋아!"')).toHaveClass('text-[var(--p-10)]');
    expect(screen.getByText('"조심!"')).toHaveClass('text-[var(--p-10)]');
    expect(screen.getByText('"이렇게 해봐!"')).toHaveClass('text-[var(--p-10)]');

    const actionList = screen.getByTestId('hapcard-actions');
    expect(actionList).not.toHaveTextContent('초반에는 약속을 작게 잡고 상대 반응을 천천히 확인하세요.');
    expect(actionList).toHaveTextContent(
      '상대가 먼저 다가오면 바로 맞추려 하기보다, 연락 빈도나 만나는 속도를 한 문장으로 정해보세요.',
    );
  });

  it('expands the detail panel inline instead of opening a popup', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => withVisuals({
        content: {
          ...mockHapcardResult.content,
          main_text: '결론: 함께 일할 때 기준이 비슷합니다. 강점으로는 안정적인 실행과 빠른 아이디어가 서로 보완됩니다. 주의점으로는 역할이 겹치지 않게 나누는 약속이 필요합니다.',
        },
      }),
    });
    await renderHapcardPage();

    const expandButton = await screen.findByRole('button', { name: '더 자세히 펼쳐보기' });
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(expandButton);

    const panel = screen.getByTestId('hapcard-expand-panel');
    expect(screen.queryByRole('dialog', { name: '자세히 보기' })).not.toBeInTheDocument();
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('rounded-[var(--r-xl)]');
    expect(screen.getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('hapcard-expand-summary-text')).toHaveClass('space-y-4');
    expect(screen.getByTestId('hapcard-expand-summary-line-conclusion')).toHaveClass('leading-[1.75]');
    expect(screen.getByTestId('hapcard-expand-summary-line-conclusion').textContent).toBe(
      '결론 = 함께 일할 때 기준이 비슷합니다.',
    );
    expect(screen.getByTestId('hapcard-expand-summary-line-strength').textContent).toBe(
      '강점 = 안정적인 실행과 빠른 아이디어가 서로 보완됩니다.',
    );
    expect(screen.getByTestId('hapcard-expand-summary-line-caution').textContent).toBe(
      '주의 = 역할이 겹치지 않게 나누는 약속이 필요합니다.',
    );
    expect(screen.getByText('결론')).toHaveClass('font-black');
    expect(screen.getByText('강점')).toHaveClass('font-black');
    expect(screen.getByText('주의')).toHaveClass('font-black');

    await user.click(screen.getByRole('button', { name: '접기' }));

    expect(screen.queryByTestId('hapcard-expand-panel')).not.toBeInTheDocument();
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
    expect(await screen.findByText('오늘 케미 준비 중')).toBeInTheDocument();
    expect(
      screen.getByText('인연의 사주맵 계산이 아직 준비되지 않았어요. 곧 자동으로 생성됩니다.'),
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
    expect(await screen.findByText('내 프로필이 먼저 필요해요')).toBeInTheDocument();
    expect(screen.getByText('오늘 케미를 보려면 내 프로필을 먼저 등록해야 해요.')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: '내 프로필 등록하기' });
    expect(cta).toHaveAttribute('href', '/onboarding');
  });

  it('shows generic error on 401', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'unauth' } }),
    });
    await renderHapcardPage();
    expect(
      await screen.findByText('오늘 케미를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
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
      await screen.findByText('오늘 케미를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });

  it('shows generic error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'));
    await renderHapcardPage();
    expect(
      await screen.findByText('오늘 케미를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });
});
