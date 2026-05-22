// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../utils/render-with-providers';
import type { FeedItem } from '@/types/relation';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderFeedPage() {
  const { default: FeedPage } = await import('@/app/(app)/feed/page');
  return renderWithProviders(<FeedPage />);
}

describe('FeedPage', () => {
  it('renders feed title', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();
    expect(await screen.findByText('너랑나랑')).toBeInTheDocument();
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
    expect(link).toHaveAttribute('href', `/hapcard/r1?mode=${encodeURIComponent('친구합')}`);
  });

  it('renders mode badge label translated for each card', async () => {
    const items: FeedItem[] = [
      { relation_id: 'r1', nickname: '봄달', mode: '친구합', compat_score: 65, change_score: 0, has_significant_change: false, created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    expect(await screen.findByText('친구')).toBeInTheDocument();
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

  it('compat_score가 있는 인연 — 오늘온도로 표시됨', async () => {
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
    const 썸합btn = screen.getByRole('radio', { name: '끌림' });
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
    const 썸합btn = screen.getByRole('radio', { name: '끌림' });
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
    ['돈합', '돈'],
    ['첫합', '처음'],
    ['오래합', '오래'],
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
    for (const name of ['전체', '일', '친구', '돈', '처음', '끌림', '오래']) {
      expect(await screen.findByRole('radio', { name })).toBeInTheDocument();
    }
  });
});
