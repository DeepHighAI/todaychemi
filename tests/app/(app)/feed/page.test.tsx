// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders } from '../../../utils/render-with-providers';
import type { FeedItem } from '@/types/relation';
import messages from '../../../../messages/ko.json';

const mockUseSearchParams = vi.hoisted(() => vi.fn(() => new URLSearchParams()));
const mockRouterPush = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn(), replace: vi.fn() }),
  useSearchParams: mockUseSearchParams,
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderFeedPage() {
  const { default: FeedPage } = await import('@/app/(app)/feed/page');
  return renderWithProviders(<FeedPage />);
}

async function renderFeedPageWithQueryClient(queryClient: QueryClient) {
  const { default: FeedPage } = await import('@/app/(app)/feed/page');
  return render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <FeedPage />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('FeedPage', () => {
  it('renders feed title', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();
    expect(await screen.findByText('케미피드')).toBeInTheDocument();
  });

  it('shows empty state when no relations exist', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();
    expect(
      await screen.findByText('아직 등록된 인연이 없어요. 첫 인연을 추가해보세요.'),
    ).toBeInTheDocument();
  });

  it('renders relation cards when items returned', async () => {
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달', mode: '친구합', compat_score: 72, change_score: 15, has_significant_change: true, created_at: '2026-05-05T10:00:00Z' },
      { relation_id: 'r2', nickname: '여름새', mode: '오래합', compat_score: 60, change_score: 3, has_significant_change: false, created_at: '2026-05-04T08:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    expect(await screen.findByText('봄달')).toBeInTheDocument();
    expect(screen.getByText('여름새')).toBeInTheDocument();
  });

  it('card link includes mode query param', async () => {
    // has_significant_change=true renders as Liquid Glass <Link>; SwipeRow items use onClick
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달이', mode: '친구합', compat_score: 65, change_score: 5, has_significant_change: true, created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    const link = await screen.findByRole('link', { name: /봄달이/ });
    expect(link).toHaveAttribute('href', '/feed/r1');
  });

  it('renders mode badge label translated for each card', async () => {
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달', mode: '친구합', compat_score: 65, change_score: 0, has_significant_change: false, created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    expect(await screen.findByText('친구 관계')).toBeInTheDocument();
  });

  it('일반 피드 row 클릭 시 relation detail 로 이동한다', async () => {
    const user = userEvent.setup();
    const items: FeedItem[] = [
      { relation_id: 'r-row', nickname: '줄클릭', mode: '친구합', compat_score: 65, change_score: 0, has_significant_change: false, created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    await user.click(await screen.findByRole('button', { name: /줄클릭/ }));

    expect(mockRouterPush).toHaveBeenCalledWith('/feed/r-row');
  });

  it('일반 피드 row 는 Enter 키로도 relation detail 로 이동한다', async () => {
    const user = userEvent.setup();
    const items: FeedItem[] = [
      { relation_id: 'r-key', nickname: '키이동', mode: '친구합', compat_score: 65, change_score: 0, has_significant_change: false, created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    const row = await screen.findByRole('button', { name: /키이동/ });
    row.focus();
    await user.keyboard('{Enter}');

    expect(mockRouterPush).toHaveBeenCalledWith('/feed/r-key');
  });

  it('shows generic error when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ code: 'INTERNAL_ERROR' }) });
    await renderFeedPage();

    await waitFor(() =>
      expect(screen.getByText('인연을 불러오지 못했어요. 잠시 후 다시 시도해주세요.')).toBeInTheDocument(),
    );
  });

  it('renders "인연 추가" link to /relations/new', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();

    const link = await screen.findByRole('link', { name: '인연 추가' });
    expect(link).toHaveAttribute('href', '/relations/new');
  });

  it('calls GET /api/feed on mount (not /api/relations)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/feed'));
    expect(mockFetch).not.toHaveBeenCalledWith('/api/relations');
  });

  it('focus query forces fresh feed data so newly created money relation appears', async () => {
    // Regression: ISSUE-001 — /feed?focus=... reused the fresh root feed cache for 60s.
    // Found by /qa on 2026-06-05.
    // Report: browser comment on /feed?focus=f5b3166f-188a-4577-bdc2-d9ccf29a4d43.
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ focus: 'r-money' }));
    const staleItems: FeedItem[] = [
      { relation_id: 'r-old', nickname: '너야', mode: '첫합', compat_score: 77, change_score: 0, has_significant_change: false, created_at: '2026-06-04T10:00:00Z' },
    ];
    const freshItems: FeedItem[] = [
      { relation_id: 'r-old', nickname: '너야', mode: '첫합', compat_score: 77, change_score: 0, has_significant_change: false, created_at: '2026-06-04T10:00:00Z' },
      { relation_id: 'r-money', nickname: '돈새', mode: '돈합', compat_score: null, change_score: 0, has_significant_change: false, created_at: '2026-06-05T10:00:00Z' },
    ];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    queryClient.setQueryData(['feed'], staleItems);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: freshItems }) });

    await renderFeedPageWithQueryClient(queryClient);

    expect(await screen.findAllByText('돈새')).toHaveLength(2);
    expect(screen.getAllByText('돈 관계').length).toBeGreaterThan(0);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/feed'));
  });

  it('compat_score가 있는 인연 — 케미온도로 표시됨', async () => {
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달', mode: '친구합', compat_score: 72, change_score: 5, has_significant_change: false, created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    expect(await screen.findByText('38.1°C')).toBeInTheDocument();
    expect(screen.queryByText('72')).toBeNull();
  });

  it('has_significant_change=true → 오늘 변화 큼 하이라이트 카드 렌더됨', async () => {
    // Redesign: highlight card (Liquid Glass <Link>) replaces ChangeBadge component
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달이', mode: '친구합', compat_score: 82, change_score: 15, has_significant_change: true, created_at: '2026-05-05T10:00:00Z' },
      { relation_id: 'r2', nickname: '여름새', mode: '오래합', compat_score: 60, change_score: 3, has_significant_change: false, created_at: '2026-05-04T08:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    // r1만 significant=true → Liquid Glass 하이라이트 카드의 eyebrow 1개
    expect(await screen.findByText(/오늘 변화 큼/)).toBeInTheDocument();
  });

  it('has_significant_change=false 전용 목록 → 하이라이트 카드 없음', async () => {
    // Redesign: no Liquid Glass highlight card when has_significant_change=false
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달이', mode: '친구합', compat_score: 65, change_score: 3, has_significant_change: false, created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    await screen.findByText('봄달이');
    expect(screen.queryByText(/오늘 변화 큼/)).toBeNull();
  });

  it('필터 클릭 시 해당 모드 항목만 표시된다', async () => {
    const user = userEvent.setup();
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달이', mode: '썸합', compat_score: 70, change_score: 0, has_significant_change: false, created_at: '2026-05-05T10:00:00Z' },
      { relation_id: 'r2', nickname: '여름새', mode: '친구합', compat_score: 60, change_score: 0, has_significant_change: false, created_at: '2026-05-04T08:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    await screen.findByText('봄달이');
    const 썸합btn = screen.getByRole('radio', { name: '썸 관계' });
    await user.click(썸합btn);

    expect(screen.getByText('봄달이')).toBeInTheDocument();
    expect(screen.queryByText('여름새')).not.toBeInTheDocument();
  });

  it('필터 0건이면 emptyFilter 메시지 표시, 전체 빈 상태 CTA는 미노출', async () => {
    const user = userEvent.setup();
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달이', mode: '친구합', compat_score: 70, change_score: 0, has_significant_change: false, created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    await screen.findByText('봄달이');
    const 썸합btn = screen.getByRole('radio', { name: '썸 관계' });
    await user.click(썸합btn);

    expect(await screen.findByText('이 관계 유형의 인연이 없어요.')).toBeInTheDocument();
    expect(screen.queryByText('첫 인연 등록하기')).not.toBeInTheDocument();
  });

  it('데이터 0건(글로벌 empty)이면 CTA 버튼 표시, emptyFilter는 미노출', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();

    expect(await screen.findByRole('button', { name: '첫 인연 등록하기' })).toBeInTheDocument();
    expect(screen.queryByText('이 관계 유형의 인연이 없어요.')).not.toBeInTheDocument();
  });

  it('필터 라디오그룹은 전체 + 6모드 = 7개 옵션을 노출한다', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();
    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(7);
  });

  it.each([
    ['돈합', '돈 관계'],
    ['첫합', '첫 만남'],
    ['오래합', '오래된 관계'],
  ])('%s 필터 클릭 시 해당 모드 항목만 표시된다', async (modeKey, labelText) => {
    const user = userEvent.setup();
    // 닉네임 3글자 이상: avatar slice(0,2)='대상' ≠ p='대상이' 충돌 방지
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '대상이', mode: modeKey as FeedItem['mode'],
        compat_score: 70, change_score: 0, has_significant_change: false,
        created_at: '2026-05-05T10:00:00Z' },
      { relation_id: 'r2', nickname: '제외야', mode: '친구합',
        compat_score: 60, change_score: 0, has_significant_change: false,
        created_at: '2026-05-04T08:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    await screen.findByText('대상이');
    const btn = screen.getByRole('radio', { name: labelText });
    await user.click(btn);

    expect(screen.getByText('대상이')).toBeInTheDocument();
    expect(screen.queryByText('제외야')).not.toBeInTheDocument();
  });

  it('필터 7개 pill 모두 단축 라벨로 표시된다', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();
    for (const name of ['전체', '일 관계', '친구 관계', '돈 관계', '첫 만남', '썸 관계', '오래된 관계']) {
      expect(await screen.findByRole('radio', { name })).toBeInTheDocument();
    }
  });

  it('인연 삭제 성공 시 feed/relations/today 캐시를 함께 무효화한다', async () => {
    const user = userEvent.setup();
    const items: FeedItem[] = [
      {
        relation_id: 'r-feed',
        nickname: '피드인연',
        mode: '친구합',
        compat_score: 65,
        change_score: 0,
        has_significant_change: false,
        created_at: '2026-06-05T10:00:00Z',
      },
    ];
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/feed') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items }),
        });
      }
      if (url === '/api/relations/r-feed' && init?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await renderFeedPageWithQueryClient(queryClient);

    const deleteButtons = await screen.findAllByRole('button', { name: '삭제' });
    await user.click(deleteButtons[0]);
    expect(await screen.findByText('피드인연 인연을 삭제할까요?')).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: '삭제' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['relations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['today'] });
  });
});

describe('FeedPage — paid=relation_slot draft reset (A2, 이중결제 차단)', () => {
  it('?paid=relation_slot:* 복귀 시 relations draft 를 리셋한다', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ paid: 'relation_slot:pend-1' }));
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const { useRelationDraft } = await import('@/lib/relations/draft-store');
    useRelationDraft.getState().setNickname('결제한인연');

    await renderFeedPage();

    // 현금 결제는 confirm 303 전면 리다이렉트로 복귀 — mode 페이지 reset 이 실행되지
    // 않으므로 여기서 비우지 않으면 결제한 인연이 프리필 재제출(이중결제)된다.
    await waitFor(() => expect(useRelationDraft.getState().nickname).toBe(''));
  });

  it('relation_slot 외 paid(케미카드 등) 복귀는 draft 를 건드리지 않는다', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ paid: 'cache-key-abc' }));
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const { useRelationDraft } = await import('@/lib/relations/draft-store');
    useRelationDraft.getState().setNickname('유지되어야함');

    await renderFeedPage();

    expect(await screen.findByText('케미피드')).toBeInTheDocument();
    expect(useRelationDraft.getState().nickname).toBe('유지되어야함');
  });
});
