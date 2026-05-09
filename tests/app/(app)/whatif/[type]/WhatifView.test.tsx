// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/render-with-providers';
import { WhatifView } from '@/app/(app)/whatif/[type]/WhatifView';
import {
  makeMockInsertedRow,
  MOCK_LLM_OUTPUT,
  MOCK_LLM_OUTPUT_WITH_CITATION,
} from '../../../../fixtures/whatif';

const mockFetch = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ type: 'work' }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WhatifView', () => {
  it('loading 상태일 때 LoadingState 노출', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<WhatifView />);
    expect(await screen.findByTestId('loading-state')).toBeInTheDocument();
  });

  it('success(work) → whatif-view + hero/keywords/do-first 노출, first-meet-tips 미노출', async () => {
    const result = makeMockInsertedRow();
    mockFetch.mockResolvedValue({ ok: true, json: async () => result });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByTestId('whatif-view')).toBeInTheDocument();
    expect(screen.getByTestId('whatif-hero')).toBeInTheDocument();
    expect(screen.getByTestId('whatif-keywords')).toBeInTheDocument();
    expect(screen.getByTestId('whatif-do-first')).toBeInTheDocument();
    expect(screen.queryByTestId('whatif-first-meet-tips')).toBeNull();
  });

  it('POST /api/whatif/<type> 호출', async () => {
    const result = makeMockInsertedRow();
    mockFetch.mockResolvedValue({ ok: true, json: async () => result });
    renderWithProviders(<WhatifView />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/whatif/work');
    expect(init.method).toBe('POST');
  });

  it('INSUFFICIENT_TOKENS → 토큰 부족 카드 노출, ErrorCard 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { code: 'INSUFFICIENT_TOKENS' } }),
    });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByTestId('whatif-insufficient-tokens')).toBeInTheDocument();
    expect(screen.queryByTestId('error-card')).toBeNull();
  });

  it('INSUFFICIENT_TOKENS 카드에 i18n 카피 노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { code: 'INSUFFICIENT_TOKENS' } }),
    });
    renderWithProviders(<WhatifView />);
    expect(
      await screen.findByText('토큰이 부족해요. 충전 후 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });

  it('GROUNDING_FAILED → ErrorCard 노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'GROUNDING_FAILED' } }),
    });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByTestId('error-card')).toBeInTheDocument();
  });

  it('INTERNAL_ERROR → ErrorCard 노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR' } }),
    });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByTestId('error-card')).toBeInTheDocument();
  });

  it('success(first_meet) + first_meet_tips 있음 → FirstMeetTips 노출', async () => {
    const result = {
      ...makeMockInsertedRow(),
      type: 'first_meet' as const,
      content: {
        ...MOCK_LLM_OUTPUT,
        first_meet_tips: ['팁 1', '팁 2', '팁 3'] as [string, string, string],
      },
    };
    mockFetch.mockResolvedValue({ ok: true, json: async () => result });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByTestId('whatif-first-meet-tips')).toBeInTheDocument();
  });

  it('success + classic_citation 있음 → ClassicCitation 노출', async () => {
    const result = { ...makeMockInsertedRow(), content: MOCK_LLM_OUTPUT_WITH_CITATION };
    mockFetch.mockResolvedValue({ ok: true, json: async () => result });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByTestId('whatif-classic-citation')).toBeInTheDocument();
  });

  it('success + classic_citation 없음 → ClassicCitation 미노출', async () => {
    const result = makeMockInsertedRow();
    mockFetch.mockResolvedValue({ ok: true, json: async () => result });
    renderWithProviders(<WhatifView />);
    await screen.findByTestId('whatif-view');
    expect(screen.queryByTestId('whatif-classic-citation')).toBeNull();
  });
});
