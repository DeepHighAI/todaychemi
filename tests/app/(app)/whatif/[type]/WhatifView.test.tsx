// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/render-with-providers';
import { ERROR_COPY } from '@/lib/errors/error-codes';
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

  it('INSUFFICIENT_TOKENS 에러 → error-card 렌더 (충전 링크 없음 ADR-039)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { code: 'INSUFFICIENT_TOKENS', message: 'insufficient' } }),
    });
    renderWithProviders(<WhatifView />);
    await screen.findByTestId('error-card');
    expect(screen.queryByRole('link', { name: '충전하러 가기' })).toBeNull();
  });

  it('PAYMENT_REQUIRED(402) → 결제 시트 렌더, ErrorCard 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
        feature: 'whatif',
        ref: 'cache-xyz',
        amount_krw: 500,
      }),
    });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByTestId('feature-pay-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('error-card')).toBeNull();
  });

  it('PAYMENT_REQUIRED(402) 이지만 ref 누락 → INTERNAL_ERROR ErrorCard, 결제 시트 미노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
        feature: 'whatif',
        amount_krw: 500,
      }),
    });
    renderWithProviders(<WhatifView />);

    expect(await screen.findByText(ERROR_COPY['INTERNAL_ERROR'])).toBeInTheDocument();
    expect(screen.queryByTestId('feature-pay-sheet')).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
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

  it('GROUNDING_FAILED → ErrorCard 에 GROUNDING_FAILED 카피 노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'GROUNDING_FAILED' } }),
    });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByText(ERROR_COPY['GROUNDING_FAILED'])).toBeInTheDocument();
  });

  it('INTERNAL_ERROR → ErrorCard 에 INTERNAL_ERROR 카피 노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR' } }),
    });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByText(ERROR_COPY['INTERNAL_ERROR'])).toBeInTheDocument();
  });

  it('알 수 없는 코드 → INTERNAL_ERROR fallback 카피 노출', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'UNKNOWN_FOO' } }),
    });
    renderWithProviders(<WhatifView />);
    expect(await screen.findByText(ERROR_COPY['INTERNAL_ERROR'])).toBeInTheDocument();
  });
});
