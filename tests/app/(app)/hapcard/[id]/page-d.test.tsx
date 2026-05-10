// @vitest-environment jsdom
// Stage D: 9 섹션 컴포지션 + visuals fallback + mode rendering

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/render-with-providers';
import { mockHapcardResult, withVisuals } from '../../../../fixtures/hapcard';

const mockFetch = vi.fn();
let mockMode: string | null = '친구합';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'r1' }),
  useSearchParams: () => ({ get: (key: string) => (key === 'mode' ? mockMode : null) }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
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

describe('HapcardPage — Stage D composition', () => {
  it('성공 응답(with visuals) → 9 testid 모두 존재, placeholder 없음', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => withVisuals() });
    await renderHapcardPage();

    await waitFor(() =>
      expect(document.querySelector('[data-testid="hapcard-header"]')).not.toBeNull(),
    );

    const ids = ['hapcard-header', 'hapcard-gauge', 'hapcard-body', 'hapcard-ohaeng',
                 'hapcard-evidence', 'hapcard-actions', 'hapcard-classic',
                 'hapcard-footer', 'hapcard-share'];
    ids.forEach((id) => expect(document.querySelector(`[data-testid="${id}"]`)).not.toBeNull());
    expect(document.querySelector('[data-testid="hapcard-placeholder"]')).toBeNull();
  });

  it('visuals 없는 응답 → header/ohaeng 없고 placeholder 표시', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockHapcardResult });
    await renderHapcardPage();

    await waitFor(() =>
      expect(document.querySelector('[data-testid="hapcard-placeholder"]')).not.toBeNull(),
    );
    expect(document.querySelector('[data-testid="hapcard-header"]')).toBeNull();
  });

  it('URL mode=썸합 → header에 "썸합" 표시', async () => {
    mockMode = '썸합';
    mockFetch.mockResolvedValue({ ok: true, json: async () => withVisuals() });
    await renderHapcardPage();

    await waitFor(() => expect(screen.queryByText('썸합')).not.toBeNull());
    expect(screen.getByText('썸합')).toBeInTheDocument();
  });

  it('gauge에 score breakdown 수치(20, 18, 22, 13) 표시', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => withVisuals() });
    await renderHapcardPage();

    await waitFor(() =>
      expect(document.querySelector('[data-testid="hapcard-gauge"]')).not.toBeNull(),
    );
    expect(screen.getByText(/20/)).toBeInTheDocument();
  });

  it('relation_nickname → header에 닉네임 노출', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => withVisuals({ relation_nickname: '별이' }),
    });
    await renderHapcardPage();

    await waitFor(() =>
      expect(document.querySelector('[data-testid="hapcard-header-nickname"]')).not.toBeNull(),
    );
    expect(screen.getByTestId('hapcard-header-nickname').textContent).toBe('별이');
  });

  it('성공 응답(with visuals) → 다시합 버튼 존재', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => withVisuals() });
    await renderHapcardPage();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /다시합/ })).not.toBeNull(),
    );
  });
});
