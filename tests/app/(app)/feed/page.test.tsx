// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/render-with-providers';

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
    expect(await screen.findByText('내 인연')).toBeInTheDocument();
  });

  it('shows empty state when no relations exist', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();
    expect(
      await screen.findByText('아직 등록된 인연이 없어요. 첫 인연을 추가해보세요.'),
    ).toBeInTheDocument();
  });

  it('renders relation cards when items returned', async () => {
    const items = [
      { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
      { relation_id: 'r2', nickname: '여름새', mode: '오래합', created_at: '2026-05-04T08:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    expect(await screen.findByText('봄달')).toBeInTheDocument();
    expect(screen.getByText('여름새')).toBeInTheDocument();
  });

  it('card link includes mode query param', async () => {
    const items = [
      { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await renderFeedPage();

    const link = await screen.findByRole('link', { name: /봄달/ });
    expect(link).toHaveAttribute('href', `/hapcard/r1?mode=${encodeURIComponent('친구합')}`);
  });

  it('renders mode badge label translated for each card', async () => {
    const items = [
      { relation_id: 'r1', nickname: '봄달', mode: '친구합', created_at: '2026-05-05T10:00:00Z' },
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

  it('calls GET /api/relations on mount', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await renderFeedPage();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/relations'));
  });
});
